#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
};

use crate::{AnchorStake, AnchorStakeClient};

fn setup_env() -> (Env, AnchorStakeClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc_address = Address::generate(&env); // Mocked for setup
    let anchor = Address::generate(&env);
    let factory = Address::generate(&env);

    let contract_id = env.register(AnchorStake, ());
    let client = AnchorStakeClient::new(&env, &contract_id);
    client.initialize(&admin, &factory, &usdc_address);

    (env, client, anchor, admin, usdc_address)
}

#[test]
fn test_register_anchor() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    
    // Test that an unregistered anchor has 0 ACR
    let dummy = Address::generate(&_env);
    assert_eq!(client.get_acr(&dummy), 0);

    // After registration, it defaults to 10,000 (perfect score) before metrics are pushed
    client.register_anchor(&anchor, &0u32);
    assert_eq!(client.get_acr(&anchor), 10_000);
}

#[test]
fn test_update_anchor_metrics_basic() {
    let (_env, client, anchor, admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);

    // Push perfect metrics
    client.update_anchor_metrics(
        &admin,
        &anchor,
        &10_000u32, // success_rate_bps
        &60u32,     // avg_latency_seconds (under 120s limit)
        &0u32,      // failed_withdrawals
        &10_000u32, // oracle_uptime_bps
        &0i128,     // historical_payouts
    );

    assert_eq!(client.get_acr(&anchor), 10_000);
}

#[test]
fn test_update_anchor_metrics_penalties() {
    let (_env, client, anchor, admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);

    // Success rate penalty
    client.update_anchor_metrics(
        &admin, &anchor,
        &9950u32, // success_rate_bps (99.5%)
        &60u32, &0u32, &10_000u32, &0i128
    );
    assert_eq!(client.get_acr(&anchor), 9950);

    // Latency penalty: 180s = 60s over 120s limit -> 60 * 10 = 600 bps penalty
    client.update_anchor_metrics(
        &admin, &anchor,
        &10_000u32,
        &180u32, // avg_latency_seconds
        &0u32, &10_000u32, &0i128
    );
    assert_eq!(client.get_acr(&anchor), 9400); // 10000 - 600

    // Failed withdrawals penalty: 3 failures -> 3 * 50 = 150 bps penalty
    client.update_anchor_metrics(
        &admin, &anchor,
        &10_000u32,
        &60u32,
        &3u32, // failed_withdrawals
        &10_000u32, &0i128
    );
    assert_eq!(client.get_acr(&anchor), 9850); // 10000 - 150

    // Oracle uptime penalty: 9900 bps
    client.update_anchor_metrics(
        &admin, &anchor,
        &10_000u32, &60u32, &0u32,
        &9900u32, // oracle_uptime_bps
        &0i128
    );
    assert_eq!(client.get_acr(&anchor), 9900);
}

#[test]
fn test_update_anchor_metrics_bonus() {
    let (_env, client, anchor, admin, _usdc) = setup_env();
    client.register_anchor(&anchor, &0u32);

    // Historical payouts bonus: 20k USDC = 200,000,000,000 stroops
    // 200B / 1B = +200 bps bonus
    client.update_anchor_metrics(
        &admin, &anchor,
        &10_000u32,
        &60u32,
        &0u32,
        &10_000u32,
        &200_000_000_000i128 // historical_payouts
    );

    // Clamps at 10,000 so we shouldn't see it go over
    assert_eq!(client.get_acr(&anchor), 10_000);

    // Apply some penalty so we can see the bonus take effect
    client.update_anchor_metrics(
        &admin, &anchor,
        &9000u32, // success_rate_bps drops it to 9000
        &60u32,
        &0u32,
        &10_000u32,
        &200_000_000_000i128 // historical_payouts adds 200 back
    );
    assert_eq!(client.get_acr(&anchor), 9200); // 9000 + 200
}

#[test]
#[should_panic(expected = "unauthorized")]
fn test_unauthorized_metrics_update_fails() {
    let (_env, client, anchor, _admin, _usdc) = setup_env();
    let imposter = Address::generate(&_env);
    
    // Should panic because imposter is not admin
    client.update_anchor_metrics(
        &imposter,
        &anchor,
        &10_000u32,
        &60u32,
        &0u32,
        &10_000u32,
        &0i128,
    );
}

#[test]
fn test_get_all_acr() {
    let (env, client, anchor1, admin, _usdc) = setup_env();
    let anchor2 = Address::generate(&env);

    client.register_anchor(&anchor1, &0u32);
    client.register_anchor(&anchor2, &1u32);

    client.update_anchor_metrics(
        &admin, &anchor1,
        &9500u32, &60u32, &0u32, &10_000u32, &0i128
    );
    client.update_anchor_metrics(
        &admin, &anchor2,
        &9900u32, &60u32, &0u32, &10_000u32, &0i128
    );

    let all_acr = client.get_all_acr();
    assert_eq!(all_acr.len(), 2);
}
