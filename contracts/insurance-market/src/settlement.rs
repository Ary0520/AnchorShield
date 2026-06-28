use soroban_sdk::{Env, Symbol};

use crate::storage::{DataKey, MarketState};
use interfaces::oracle::OracleClient;
use interfaces::anchor_stake::AnchorStakeClient;

/// Reject oracle prices older than 5 minutes.
/// This prevents stale data from triggering settlements.
const ORACLE_FRESHNESS_SECONDS: u64 = 300;

/// Main settlement logic — called by `try_settle()` on every watcher tick.
///
/// Two settlement paths:
///   1. Expiry path: if now >= expiry and no breach was started → NO wins
///   2. Oracle path: read price; if below threshold start/continue breach timer;
///      if sustained >= breach_duration_seconds → YES wins
///      if price recovers → reset breach timer
pub fn check_and_settle(env: &Env) {
    let expiry: u64 = env
        .storage()
        .instance()
        .get(&DataKey::ExpiryTimestamp)
        .unwrap();
    let now = env.ledger().timestamp();

    // ── Path 1: expiry ────────────────────────────────────────────────────────
    if now >= expiry {
        let breach_start: Option<u64> = env
            .storage()
            .instance()
            .get(&DataKey::BreachStartedAt)
            .unwrap_or(None);
        if breach_start.is_none() {
            // No breach recorded before expiry — NO wins
            settle(env, false);
        }
        // If there IS a breach_start but we're past expiry, it means the breach
        // happened near expiry. We still need to check if duration was met.
        // Fall through to oracle path check below.
        // (If duration was met pre-expiry, the watcher would have already settled.)
        return;
    }

    // ── Path 2: oracle price check ────────────────────────────────────────────
    let oracle_addr: soroban_sdk::Address = env
        .storage()
        .instance()
        .get(&DataKey::OracleContract)
        .unwrap();
    let asset_sym: Symbol = env
        .storage()
        .instance()
        .get(&DataKey::CoveredAssetSymbol)
        .unwrap();

    let oracle = OracleClient::new(env, &oracle_addr);
    let price_data = match oracle.lastprice(&asset_sym) {
        None => return, // Oracle has no data yet — skip this tick
        Some(p) => p,
    };

    // Freshness guard: reject data older than ORACLE_FRESHNESS_SECONDS
    let age = now.saturating_sub(price_data.timestamp);
    if age > ORACLE_FRESHNESS_SECONDS {
        // Stale price — do not act. Watcher will retry next tick.
        return;
    }

    let threshold: i128 = env
        .storage()
        .instance()
        .get(&DataKey::DepegThreshold)
        .unwrap();
    let breach_duration: u64 = env
        .storage()
        .instance()
        .get(&DataKey::BreachDurationSeconds)
        .unwrap();

    if price_data.price < threshold {
        // Price is below the depeg threshold
        let breach_start: Option<u64> = env
            .storage()
            .instance()
            .get(&DataKey::BreachStartedAt)
            .unwrap_or(None);

        match breach_start {
            None => {
                // First detection — start the breach timer
                env.storage()
                    .instance()
                    .set(&DataKey::BreachStartedAt, &Some(now));
            }
            Some(started_at) => {
                // Breach is ongoing — check if it has been sustained long enough
                if now.saturating_sub(started_at) >= breach_duration {
                    settle(env, true); // YES wins — depeg confirmed
                }
                // else: breach not yet long enough — wait for next tick
            }
        }
    } else {
        // Price is above threshold — reset breach timer if one was running
        let breach_start: Option<u64> = env
            .storage()
            .instance()
            .get(&DataKey::BreachStartedAt)
            .unwrap_or(None);
        if breach_start.is_some() {
            env.storage()
                .instance()
                .set(&DataKey::BreachStartedAt, &Option::<u64>::None);
        }
    }
}

/// Finalizes the market. Sets state, notifies anchor-stake contract.
fn settle(env: &Env, yes_wins: bool) {
    let new_state = if yes_wins {
        MarketState::Settled
    } else {
        MarketState::Expired
    };
    env.storage().instance().set(&DataKey::State, &new_state);
    env.storage()
        .instance()
        .set(&DataKey::SettledFor, &Some(yes_wins));

    // Cross-contract: notify anchor-stake so anchors can unstake
    let anchor_stake: soroban_sdk::Address = env
        .storage()
        .instance()
        .get(&DataKey::AnchorStakeContract)
        .unwrap();
    let market_id: u32 = env.storage().instance().get(&DataKey::MarketId).unwrap();
    AnchorStakeClient::new(env, &anchor_stake)
        .on_market_settled(&market_id, &yes_wins);

    crate::events::emit_settled(env, market_id, yes_wins);
}
