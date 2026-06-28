#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

use crate::{AnchorStake, AnchorStakeClient};

fn setup_env() -> (Env, AnchorStakeClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc_address = usdc_id.address();

    let anchor = Address::generate(&env);
    let usdc_client = StellarAssetClient::new(&env, &usdc_address);
    usdc_client.mint(&anchor, &1_000_000_000i128);

    let factory = Address::generate(&env);
    let contract_id = env.register(AnchorStake, ());
    let client = AnchorStakeClient::new(&env, &contract_id);
    client.initialize(&admin, &factory, &usdc_address);

    (env, client, anchor, admin, usdc_address)
}

#[test]
fn test_register_anchor() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);
    // No stake yet, no cover → ACR = 0
    assert_eq!(client.get_acr(&anchor), 0);
}

#[test]
fn test_stake_with_no_cover_gives_full_acr() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);
    client.stake(&anchor, &500_000_000i128);
    // No cover outstanding yet → ACR = ACR_PRECISION (10_000)
    assert_eq!(client.get_acr(&anchor), 10_000);
}

#[test]
fn test_acr_equals_stake_over_cover() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);
    client.stake(&anchor, &500_000_000i128);

    // Simulate 500 cover sold → ACR = 500/500 = 1.0 = 10_000 bps
    client.update_cover_outstanding(&0u32, &500_000_000i128, &true);
    assert_eq!(client.get_acr(&anchor), 10_000);

    // Simulate 500 more cover → total 1000, stake 500 → ACR = 5_000 (0.5x)
    client.update_cover_outstanding(&0u32, &500_000_000i128, &true);
    assert_eq!(client.get_acr(&anchor), 5_000);
}

#[test]
fn test_acr_double_stake_over_cover() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &1u32);
    client.stake(&anchor, &200_000_000i128);
    client.update_cover_outstanding(&1u32, &100_000_000i128, &true);
    // staked=200, cover=100 → ACR = 200/100 * 10_000 = 20_000 (2.0x)
    assert_eq!(client.get_acr(&anchor), 20_000);
    assert_eq!(client.get_stake(&anchor), 200_000_000i128);
}

#[test]
#[should_panic(expected = "market not yet settled")]
fn test_unstake_before_settlement_fails() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);
    client.stake(&anchor, &100_000_000i128);
    client.unstake(&anchor, &100_000_000i128);
}

#[test]
fn test_unstake_after_settlement() {
    let (env, client, anchor, _admin, usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);
    client.stake(&anchor, &100_000_000i128);
    client.on_market_settled(&0u32, &false); // NO wins

    let usdc_client = TokenClient::new(&env, &usdc);
    let before = usdc_client.balance(&anchor);
    client.unstake(&anchor, &100_000_000i128);
    let after = usdc_client.balance(&anchor);

    assert_eq!(after - before, 100_000_000i128);
    assert_eq!(client.get_stake(&anchor), 0);
}

#[test]
fn test_get_all_acr() {
    let (env, client, anchor1, _admin, usdc) = setup_env();
    let anchor2 = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&anchor2, &500_000_000i128);

    client.register_anchor(&anchor1, &0u32);
    client.register_anchor(&anchor2, &1u32);
    client.stake(&anchor1, &300_000_000i128);
    client.stake(&anchor2, &200_000_000i128);

    assert_eq!(client.get_all_acr().len(), 2);
}
