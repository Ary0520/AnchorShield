#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, IntoVal, Map, Symbol, Vec};

use crate::storage::{AnchorMetrics, DataKey};

mod events;
mod storage;

#[contract]
pub struct AnchorStake;

#[contractimpl]
impl AnchorStake {
    /// Called once at deployment.
    pub fn initialize(env: Env, admin: Address, factory: Address, usdc: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Factory, &factory);
        env.storage().instance().set(&DataKey::Usdc, &usdc);

        let empty_metrics: Map<Address, AnchorMetrics> = Map::new(&env);
        env.storage().instance().set(&DataKey::AnchorMetricsMap, &empty_metrics);

        let empty_cover: Map<u32, i128> = Map::new(&env);
        env.storage().instance().set(&DataKey::MarketCoverOut, &empty_cover);

        let empty_anchor_market: Map<Address, u32> = Map::new(&env);
        env.storage().instance().set(&DataKey::AnchorMarket, &empty_anchor_market);

        let empty_settled: Map<u32, bool> = Map::new(&env);
        env.storage().instance().set(&DataKey::MarketSettled, &empty_settled);

        Self::bump_ttl(&env);
    }

    /// Anchor registers itself for a specific market.
    pub fn register_anchor(env: Env, anchor: Address, market_id: u32) {
        // anchor.require_auth(); // TEMPORARILY DISABLED FOR PITCH DAY

        let mut anchor_market: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMarket)
            .unwrap_or(Map::new(&env));

        anchor_market.set(anchor.clone(), market_id);
        env.storage().instance().set(&DataKey::AnchorMarket, &anchor_market);

        events::emit_anchor_registered(&env, &anchor, market_id);
        Self::bump_ttl(&env);
    }

    /// Update operational metrics for an anchor.
    /// This is called by the off-chain Watcher (Risk Oracle) via the admin key.
    pub fn update_anchor_metrics(
        env: Env,
        admin: Address,
        anchor: Address,
        success_rate_bps: u32,
        avg_latency_seconds: u32,
        failed_withdrawals: u32,
        oracle_uptime_bps: u32,
        historical_payouts: i128,
    ) {
        // Only admin (watcher/oracle) can update metrics
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(admin == stored_admin, "unauthorized");
        admin.require_auth();

        let mut metrics_map: Map<Address, AnchorMetrics> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMetricsMap)
            .unwrap_or(Map::new(&env));

        let metrics = AnchorMetrics {
            success_rate_bps,
            avg_latency_seconds,
            failed_withdrawals,
            oracle_uptime_bps,
            historical_payouts,
        };

        metrics_map.set(anchor.clone(), metrics);
        env.storage().instance().set(&DataKey::AnchorMetricsMap, &metrics_map);

        let acr = Self::compute_acr_internal(&env, &anchor);
        events::emit_metrics_updated(&env, &anchor, acr);
        Self::bump_ttl(&env);
    }

    // -------------------------------------------------------------------------
    // Called by insurance-market contracts (cross-contract)
    // -------------------------------------------------------------------------

    pub fn update_cover_outstanding(env: Env, market_id: u32, delta: i128, increase: bool) {
        Self::verify_market_auth(&env, market_id);
        assert!(delta >= 0, "delta must be non-negative");

        let mut market_cover: Map<u32, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MarketCoverOut)
            .unwrap_or(Map::new(&env));

        let current = market_cover.get(market_id).unwrap_or(0);
        let new_val = if increase {
            current + delta
        } else {
            (current - delta).max(0)
        };
        market_cover.set(market_id, new_val);
        env.storage()
            .instance()
            .set(&DataKey::MarketCoverOut, &market_cover);

        Self::bump_ttl(&env);
    }

    pub fn on_market_settled(env: Env, market_id: u32, yes_won: bool) {
        Self::verify_market_auth(&env, market_id);
        let mut settled_map: Map<u32, bool> = env
            .storage()
            .instance()
            .get(&DataKey::MarketSettled)
            .unwrap_or(Map::new(&env));
        settled_map.set(market_id, yes_won);
        env.storage().instance().set(&DataKey::MarketSettled, &settled_map);

        events::emit_market_settled(&env, market_id, yes_won);
        Self::bump_ttl(&env);
    }

    // -------------------------------------------------------------------------
    // Public read functions
    // -------------------------------------------------------------------------

    /// THE KEY PUBLIC FUNCTION.
    ///
    /// Returns the Anchor Confidence Ratio (ACR) for an anchor in basis points.
    /// This is now a composite Operational Risk Score, scaled 0 to 10_000.
    pub fn get_acr(env: Env, anchor: Address) -> i128 {
        let anchor_market: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMarket)
            .unwrap_or(Map::new(&env));

        if !anchor_market.contains_key(anchor.clone()) {
            return 0;
        }

        Self::compute_acr_internal(&env, &anchor)
    }

    /// Returns all registered anchors and their ACR scores.
    pub fn get_all_acr(env: Env) -> Vec<(Address, i128)> {
        let metrics_map: Map<Address, AnchorMetrics> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMetricsMap)
            .unwrap_or(Map::new(&env));
        
        let mut result = Vec::new(&env);
        for k in metrics_map.keys() {
            let acr = Self::compute_acr_internal(&env, &k);
            result.push_back((k, acr));
        }
        result
    }

    pub fn get_all_metrics(env: Env) -> Vec<(Address, AnchorMetrics, i128)> {
        let metrics_map: Map<Address, AnchorMetrics> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMetricsMap)
            .unwrap_or(Map::new(&env));
        
        let mut result = Vec::new(&env);
        for k in metrics_map.keys() {
            let metrics = metrics_map.get(k.clone()).unwrap();
            let acr = Self::compute_acr_internal(&env, &k);
            result.push_back((k, metrics, acr));
        }
        result
    }

    pub fn get_cover_outstanding(env: Env, market_id: u32) -> i128 {
        let market_cover: Map<u32, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MarketCoverOut)
            .unwrap_or(Map::new(&env));
        market_cover.get(market_id).unwrap_or(0)
    }

    pub fn extend_ttl(env: Env) {
        Self::bump_ttl(&env);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    fn compute_acr_internal(env: &Env, anchor: &Address) -> i128 {
        let metrics_map: Map<Address, AnchorMetrics> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMetricsMap)
            .unwrap_or(Map::new(env));
        
        let metrics = match metrics_map.get(anchor.clone()) {
            Some(m) => m,
            None => return 10_000, // Perfect score until metrics are reported
        };

        let mut score: i128 = 10_000;

        // 1. Success rate multiplier
        score = (score * (metrics.success_rate_bps as i128)) / 10_000;

        // 2. Latency penalty (deduct 10 bps per second over 2 mins)
        if metrics.avg_latency_seconds > 120 {
            let penalty = ((metrics.avg_latency_seconds - 120) * 10).min(2000) as i128;
            score = score.saturating_sub(penalty);
        }

        // 3. Failed withdrawals penalty (deduct 50 bps per failure)
        let failure_penalty = (metrics.failed_withdrawals * 50).min(2000) as i128;
        score = score.saturating_sub(failure_penalty);

        // 4. Oracle Uptime multiplier
        score = (score * (metrics.oracle_uptime_bps as i128)) / 10_000;

        // 5. Bonus for historical payouts (+100 bps per 10k USDC paid out)
        // Note: 1 USDC = 10,000,000 stroops (7 decimals)
        // 10,000 USDC = 100,000,000,000 stroops
        let bonus = (metrics.historical_payouts / 1_000_000_000).min(2000);
        score = score.saturating_add(bonus);

        score.clamp(0, 10_000)
    }

    fn bump_ttl(env: &Env) {
        env.storage().instance().extend_ttl(100_000, 200_000);
    }

    fn verify_market_auth(env: &Env, market_id: u32) {
        let factory: Address = env.storage().instance().get(&DataKey::Factory).unwrap();
        let market_contract: Address = env.invoke_contract(
            &factory,
            &Symbol::new(env, "get_market_contract"),
            (market_id,).into_val(env),
        );
        // market_contract.require_auth(); // TEMPORARILY DISABLED FOR PITCH DAY
    }
}

mod test;
