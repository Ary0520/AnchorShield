#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String, Symbol,
};

use interfaces::oracle::{Asset, OracleTrait, PriceData};

use crate::{InsuranceMarket, InsuranceMarketClient};
use crate::storage::MarketState;
use anchor_stake::{AnchorStake, AnchorStakeClient};

const DEPEG_THRESHOLD: i128 = 9_950_000_000_000_0;
const BREACH_DURATION: u64 = 3600;
const ONE_USDC: i128 = 10_000_000; // 7 decimals

struct TestSetup {
    env: Env,
    market: InsuranceMarketClient<'static>,
    _anchor_stake: AnchorStakeClient<'static>,
    usdc: Address,
    oracle: Address,
    alice: Address,
    bob: Address,
}

#[soroban_sdk::contract]
pub struct DummyFactory;
#[soroban_sdk::contractimpl]
impl DummyFactory {
    pub fn init(e: Env, market: Address) {
        e.storage().instance().set(&Symbol::new(&e, "market"), &market);
        e.storage().instance().extend_ttl(100_000, 200_000);
    }
    pub fn get_market_contract(e: Env, _id: u32) -> Address {
        e.storage().instance().get(&Symbol::new(&e, "market")).unwrap()
    }
}

fn setup(expiry_offset: u64) -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 26,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });

    let admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc = usdc_id.address();
    let sac = StellarAssetClient::new(&env, &usdc);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    sac.mint(&alice, &(100 * ONE_USDC));
    sac.mint(&bob, &(100 * ONE_USDC));

    let oracle = Address::generate(&env);

    // Deploy insurance-market FIRST so we know its address for the dummy factory
    let market_id = env.register(InsuranceMarket, ());

    // Deploy a dummy factory
    let factory_id = env.register(DummyFactory, ());
    let dummy_client = DummyFactoryClient::new(&env, &factory_id);
    dummy_client.init(&market_id);

    // Deploy anchor-stake
    let anchor_stake_id = env.register(AnchorStake, ());
    let anchor_stake_client = AnchorStakeClient::new(&env, &anchor_stake_id);
    anchor_stake_client.initialize(&admin, &factory_id, &usdc);

    let expiry = env.ledger().timestamp() + expiry_offset;
    let market = InsuranceMarketClient::new(&env, &market_id);
    market.initialize(
        &0u32,
        &String::from_str(&env, "USDC depeg < $0.995 for 1hr"),
        &usdc,
        &Asset::Other(Symbol::new(&env, "USDC")),
        &oracle,
        &DEPEG_THRESHOLD,
        &BREACH_DURATION,
        &expiry,
        &None::<Address>,
        &anchor_stake_id,
    );

    TestSetup { env, market, _anchor_stake: anchor_stake_client, usdc, oracle, alice, bob }
}

#[test]
fn test_mint_complete_set() {
    let t = setup(86400);
    let usdc = TokenClient::new(&t.env, &t.usdc);
    let before = usdc.balance(&t.alice);

    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));

    assert_eq!(before - usdc.balance(&t.alice), 10 * ONE_USDC, "USDC deducted");
    let (yes, no) = t.market.get_balances(&t.alice);
    assert_eq!(yes, 10 * ONE_USDC, "YES balance");
    assert_eq!(no, 10 * ONE_USDC, "NO balance");
    assert_eq!(t.market.get_total_collateral(), 10 * ONE_USDC);
}

#[test]
fn test_place_buy_order_escrows_usdc() {
    let t = setup(86400);
    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));
    let usdc = TokenClient::new(&t.env, &t.usdc);
    let before = usdc.balance(&t.bob);
    let amount = 5 * ONE_USDC;
    let price_bps = 200i64;
    let expected_cost = (amount * price_bps as i128) / 10_000;

    t.market.place_order(&t.bob, &true, &price_bps, &amount);

    assert_eq!(before - usdc.balance(&t.bob), expected_cost);
    assert_eq!(t.market.get_orders().len(), 1);
}

#[test]
fn test_place_sell_order_escrows_yes() {
    let t = setup(86400);
    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));
    let (yes_before, _) = t.market.get_balances(&t.alice);

    t.market.place_order(&t.alice, &false, &150i64, &(5 * ONE_USDC));

    let (yes_after, _) = t.market.get_balances(&t.alice);
    assert_eq!(yes_before - yes_after, 5 * ONE_USDC);
}

#[test]
fn test_fill_orders_matches_buy_and_sell() {
    let t = setup(86400);
    let usdc = TokenClient::new(&t.env, &t.usdc);

    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));
    // Alice sells at 150 bps
    t.market.place_order(&t.alice, &false, &150i64, &(10 * ONE_USDC));
    // Bob buys at 200 bps — should fill at 150 (maker price)
    t.market.place_order(&t.bob, &true, &200i64, &(10 * ONE_USDC));

    let alice_before = usdc.balance(&t.alice);
    let (bob_yes_before, _) = t.market.get_balances(&t.bob);

    let filler = Address::generate(&t.env);
    t.market.fill_orders(&filler, &10u32);

    let alice_after = usdc.balance(&t.alice);
    let (bob_yes_after, _) = t.market.get_balances(&t.bob);

    let expected_premium = (10 * ONE_USDC * 150i128) / 10_000;
    assert_eq!(alice_after - alice_before, expected_premium, "alice gets 150bps premium");
    assert_eq!(bob_yes_after - bob_yes_before, 10 * ONE_USDC, "bob gets YES tokens");
    assert_eq!(t.market.get_orders().len(), 0, "orders cleared");
}

#[test]
fn test_cancel_buy_order_refunds_usdc() {
    let t = setup(86400);
    let usdc = TokenClient::new(&t.env, &t.usdc);
    let before = usdc.balance(&t.bob);
    let order_id = t.market.place_order(&t.bob, &true, &200i64, &(5 * ONE_USDC));
    assert!(usdc.balance(&t.bob) < before, "USDC escrowed");

    t.market.cancel_order(&t.bob, &order_id);
    assert_eq!(usdc.balance(&t.bob), before, "USDC refunded");
}

#[test]
fn test_cancel_sell_order_returns_yes() {
    let t = setup(86400);
    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));
    let (yes_before, _) = t.market.get_balances(&t.alice);
    let order_id = t.market.place_order(&t.alice, &false, &150i64, &(5 * ONE_USDC));
    assert!(t.market.get_balances(&t.alice).0 < yes_before, "YES escrowed");

    t.market.cancel_order(&t.alice, &order_id);
    assert_eq!(t.market.get_balances(&t.alice).0, yes_before, "YES returned");
}

#[test]
fn test_try_settle_no_wins_on_expiry() {
    let t = setup(3600);
    t.env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + 7200, // past expiry
        protocol_version: 26,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });
    t.market.try_settle();
    assert_eq!(t.market.get_state(), MarketState::Expired);
}

#[test]
fn test_claim_no_wins_pays_no_holders() {
    let t = setup(3600);
    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));
    t.env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + 7200,
        protocol_version: 26,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });
    t.market.try_settle();

    let usdc = TokenClient::new(&t.env, &t.usdc);
    let before = usdc.balance(&t.alice);
    t.market.claim(&t.alice);
    assert_eq!(usdc.balance(&t.alice) - before, 10 * ONE_USDC, "alice reclaims via NO");
}

#[test]
#[should_panic(expected = "market is not open")]
fn test_cannot_mint_after_settlement() {
    let t = setup(3600);
    t.env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + 7200,
        protocol_version: 26,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });
    t.market.try_settle();
    t.market.mint_complete_set(&t.alice, &ONE_USDC); // should panic
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_cannot_initialize_twice() {
    let t = setup(86400);
    t.market.initialize(
        &0u32,
        &String::from_str(&t.env, "duplicate"),
        &t.usdc,
        &Asset::Other(Symbol::new(&t.env, "USDC")),
        &t.oracle,
        &DEPEG_THRESHOLD,
        &BREACH_DURATION,
        &(t.env.ledger().timestamp() + 86400),
        &None::<Address>,
        &t._anchor_stake.address,
    );
}

// ─── Oracle mock ─────────────────────────────────────────────────────────────
// Following the official Stellar mocking pattern:
// https://developers.stellar.org/docs/build/guides/testing/mocking
//
// KEY: All mocks MUST be registered in the SAME Env as the contract under test.
// The setup_with_oracle_env function creates a single Env, registers the mock
// oracle into it, then initializes the market pointing at that oracle.

mod oracle_above {
    use super::*;
    use soroban_sdk::{contract, contractimpl, Env, Vec};

    /// Always returns $1.00 (healthy, above threshold).
    #[contract]
    pub struct MockOracle;

    #[contractimpl]
    impl OracleTrait for MockOracle {
        fn base(_env: Env) -> Asset { Asset::Other(Symbol::new(&_env, "USD")) }
        fn resolution(_env: Env) -> u32 { 300 }
        fn price(_env: Env, _asset: Asset, _timestamp: u64) -> Option<PriceData> { None }
        fn prices(_env: Env, _asset: Asset, _records: u32) -> Option<Vec<PriceData>> { None }
        fn lastprice(env: Env, _asset: Asset) -> Option<PriceData> {
            Some(PriceData {
                price: 100_000_000_000_000i128,
                timestamp: env.ledger().timestamp(),
            })
        }
        fn decimals(_env: Env) -> u32 { 14 }
        fn assets(env: Env) -> Vec<Asset> { Vec::new(&env) }
    }
}

mod oracle_below {
    use super::*;
    use soroban_sdk::{contract, contractimpl, Env, Vec};

    /// Always returns $0.990 (below the $0.995 depeg threshold).
    #[contract]
    pub struct MockOracle;

    #[contractimpl]
    impl OracleTrait for MockOracle {
        fn base(_env: Env) -> Asset { Asset::Other(Symbol::new(&_env, "USD")) }
        fn resolution(_env: Env) -> u32 { 300 }
        fn price(_env: Env, _asset: Asset, _timestamp: u64) -> Option<PriceData> { None }
        fn prices(_env: Env, _asset: Asset, _records: u32) -> Option<Vec<PriceData>> { None }
        fn lastprice(env: Env, _asset: Asset) -> Option<PriceData> {
            Some(PriceData {
                price: 99_000_000_000_000i128,
                timestamp: env.ledger().timestamp(),
            })
        }
        fn decimals(_env: Env) -> u32 { 14 }
        fn assets(env: Env) -> Vec<Asset> { Vec::new(&env) }
    }
}

mod oracle_stale {
    use super::*;
    use soroban_sdk::{contract, contractimpl, Env, Vec};

    /// Returns a below-threshold price but with a 10-minute-old timestamp.
    #[contract]
    pub struct MockOracle;

    #[contractimpl]
    impl OracleTrait for MockOracle {
        fn base(_env: Env) -> Asset { Asset::Other(Symbol::new(&_env, "USD")) }
        fn resolution(_env: Env) -> u32 { 300 }
        fn price(_env: Env, _asset: Asset, _timestamp: u64) -> Option<PriceData> { None }
        fn prices(_env: Env, _asset: Asset, _records: u32) -> Option<Vec<PriceData>> { None }
        fn lastprice(env: Env, _asset: Asset) -> Option<PriceData> {
            Some(PriceData {
                price: 99_000_000_000_000i128,
                timestamp: env.ledger().timestamp().saturating_sub(600),
            })
        }
        fn decimals(_env: Env) -> u32 { 14 }
        fn assets(env: Env) -> Vec<Asset> { Vec::new(&env) }
    }
}

struct OracleTestSetup {
    env: Env,
    market: InsuranceMarketClient<'static>,
    usdc: Address,
    alice: Address,
}

/// Creates one Env, registers the oracle mock INTO that env, then sets up the market.
/// The oracle_register_fn closure receives the env and returns the oracle's Address.
fn setup_oracle_env<F>(register_oracle: F, expiry_offset: u64) -> OracleTestSetup
where
    F: Fn(&Env) -> Address,
{
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 26,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });

    // Register oracle into THIS env
    let oracle_id = register_oracle(&env);

    let admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc = usdc_id.address();
    let sac = StellarAssetClient::new(&env, &usdc);

    let alice = Address::generate(&env);
    sac.mint(&alice, &(100 * ONE_USDC));

    let market_contract_id = env.register(InsuranceMarket, ());
    
    // Deploy a dummy factory
    let factory_id = env.register(DummyFactory, ());
    let dummy_client = DummyFactoryClient::new(&env, &factory_id);
    dummy_client.init(&market_contract_id);

    let anchor_stake_id = env.register(AnchorStake, ());
    let anchor_stake_client = AnchorStakeClient::new(&env, &anchor_stake_id);
    anchor_stake_client.initialize(&admin, &factory_id, &usdc);

    let expiry = env.ledger().timestamp() + expiry_offset;
    let market = InsuranceMarketClient::new(&env, &market_contract_id);
    market.initialize(
        &0u32,
        &String::from_str(&env, "USDC depeg < $0.995 for 1hr"),
        &usdc,
        &Asset::Other(Symbol::new(&env, "USDC")),
        &oracle_id,
        &DEPEG_THRESHOLD,
        &BREACH_DURATION,
        &expiry,
        &None::<Address>,
        &anchor_stake_id,
    );

    OracleTestSetup { env, market, usdc, alice }
}

// ─── Oracle-path settlement tests ────────────────────────────────────────────

#[test]
fn test_try_settle_yes_wins_after_breach_duration() {
    let t = setup_oracle_env(
        |env| env.register(oracle_below::MockOracle, ()),
        86400,
    );

    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));

    // Tick 1: first detection — breach timer starts
    t.market.try_settle();
    assert_eq!(t.market.get_state(), MarketState::Open, "still open after tick 1");
    assert!(t.market.get_breach_started_at().is_some(), "breach timer started");

    // Advance time past breach duration
    t.env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + BREACH_DURATION + 1,
        protocol_version: 26,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });

    // Tick 2: duration met → YES wins
    t.market.try_settle();
    assert_eq!(t.market.get_state(), MarketState::Settled, "YES wins after breach");
}

#[test]
fn test_try_settle_healthy_oracle_does_not_settle() {
    let t = setup_oracle_env(
        |env| env.register(oracle_above::MockOracle, ()),
        86400,
    );

    t.market.try_settle();
    assert_eq!(t.market.get_state(), MarketState::Open, "healthy market stays open");
    assert_eq!(t.market.get_breach_started_at(), None, "no breach timer started");
}

#[test]
fn test_try_settle_stale_oracle_does_not_settle() {
    let t = setup_oracle_env(
        |env| env.register(oracle_stale::MockOracle, ()),
        86400,
    );

    // Price is below threshold but timestamp is 10 min old — contract should skip
    t.market.try_settle();
    assert_eq!(t.market.get_state(), MarketState::Open, "stale oracle skipped");
    assert_eq!(t.market.get_breach_started_at(), None, "no breach from stale oracle");
}

#[test]
fn test_claim_yes_wins_pays_yes_holders() {
    let t = setup_oracle_env(
        |env| env.register(oracle_below::MockOracle, ()),
        86400,
    );

    t.market.mint_complete_set(&t.alice, &(10 * ONE_USDC));

    // Start breach
    t.market.try_settle();

    // Cross breach duration
    t.env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + BREACH_DURATION + 1,
        protocol_version: 26,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });

    t.market.try_settle();
    assert_eq!(t.market.get_state(), MarketState::Settled);

    let usdc_client = TokenClient::new(&t.env, &t.usdc);
    let before = usdc_client.balance(&t.alice);
    t.market.claim(&t.alice);
    let after = usdc_client.balance(&t.alice);

    assert_eq!(after - before, 10 * ONE_USDC, "alice claims 10 USDC via YES");
}
