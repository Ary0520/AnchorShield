#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    Address, BytesN, Env, String, Symbol,
};

use crate::{MarketFactory, MarketFactoryClient};
use anchor_stake::{AnchorStake, AnchorStakeClient};

// Import insurance-market WASM bytes for upload.
// soroban-sdk testutils generate a `WASM` const for any crate compiled
// with the `testutils` feature — accessed as `<CrateModule>::WASM`.
mod insurance_market_wasm {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/insurance_market.wasm"
    );
}

fn setup_factory() -> (
    Env,
    MarketFactoryClient<'static>,
    AnchorStakeClient<'static>,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc = usdc_id.address();

    let anchor_stake_id = env.register(AnchorStake, ());
    let anchor_stake = AnchorStakeClient::new(&env, &anchor_stake_id);
    anchor_stake.initialize(&admin, &admin, &usdc);

    let im_wasm_hash = env.deployer().upload_contract_wasm(insurance_market_wasm::WASM);

    let factory_id = env.register(MarketFactory, ());
    let factory = MarketFactoryClient::new(&env, &factory_id);
    factory.initialize(&admin, &im_wasm_hash, &anchor_stake_id);

    (env, factory, anchor_stake, admin, usdc)
}

#[test]
fn test_create_market_deploys_and_initializes() {
    let (env, factory, _as, _admin, usdc) = setup_factory();
    let oracle = Address::generate(&env);

    let market_id = factory.create_market(
        &String::from_str(&env, "USDC depeg < $0.995 for 1hr"),
        &usdc,
        &Symbol::new(&env, "USDC"),
        &oracle,
        &9_950_000_000_000_0i128,
        &3600u64,
        &(env.ledger().timestamp() + 86400),
        &None::<Address>,
    );
    assert_eq!(market_id, 0);

    let config = factory.get_market(&0u32);
    assert_eq!(config.market_id, 0);
    assert_eq!(config.collateral_token, usdc);

    // Verify deployed market contract is live via its client
    let market = insurance_market_wasm::Client::new(&env, &config.market_contract);
    assert_eq!(market.get_market_id(), 0);
    assert_eq!(market.get_total_collateral(), 0);
}

#[test]
fn test_list_markets_returns_all_ids() {
    let (env, factory, _as, _admin, usdc) = setup_factory();
    let oracle = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 86400;

    factory.create_market(
        &String::from_str(&env, "Market 0"), &usdc,
        &Symbol::new(&env, "USDC"), &oracle,
        &9_950_000_000_000_0i128, &3600u64, &expiry, &None::<Address>,
    );
    factory.create_market(
        &String::from_str(&env, "Market 1"), &usdc,
        &Symbol::new(&env, "EURC"), &oracle,
        &9_950_000_000_000_0i128, &3600u64, &expiry, &None::<Address>,
    );

    let ids = factory.list_markets();
    assert_eq!(ids.len(), 2);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_cannot_initialize_twice() {
    let (env, factory, _as, _admin, _usdc) = setup_factory();
    let dummy_hash = BytesN::from_array(&env, &[0u8; 32]);
    let dummy = Address::generate(&env);
    factory.initialize(&dummy, &dummy_hash, &dummy);
}
