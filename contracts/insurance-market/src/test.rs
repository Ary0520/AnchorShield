#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String, Symbol,
};

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

    // Deploy anchor-stake
    let anchor_stake_id = env.register(AnchorStake, ());
    let anchor_stake_client = AnchorStakeClient::new(&env, &anchor_stake_id);
    anchor_stake_client.initialize(&admin, &admin, &usdc);

    // Deploy insurance-market
    let expiry = env.ledger().timestamp() + expiry_offset;
    let market_id = env.register(InsuranceMarket, ());
    let market = InsuranceMarketClient::new(&env, &market_id);
    market.initialize(
        &0u32,
        &String::from_str(&env, "USDC depeg < $0.995 for 1hr"),
        &usdc,
        &Symbol::new(&env, "USDC"),
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
        &Symbol::new(&t.env, "USDC"),
        &t.oracle,
        &DEPEG_THRESHOLD,
        &BREACH_DURATION,
        &(t.env.ledger().timestamp() + 86400),
        &None::<Address>,
        &t._anchor_stake.address,
    );
}
