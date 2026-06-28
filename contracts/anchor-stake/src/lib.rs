#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env, Map, Vec};

use crate::storage::DataKey;

mod events;
mod storage;

/// ACR precision: 10_000 basis points = 1.00 (100%)
/// ACR = anchor_staked_usdc / total_yes_tokens_outstanding
const ACR_PRECISION: i128 = 10_000;

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

        let empty_stakes: Map<Address, i128> = Map::new(&env);
        env.storage().instance().set(&DataKey::Stakes, &empty_stakes);

        let empty_cover: Map<u32, i128> = Map::new(&env);
        env.storage().instance().set(&DataKey::MarketCoverOut, &empty_cover);

        let empty_anchor_market: Map<Address, u32> = Map::new(&env);
        env.storage().instance().set(&DataKey::AnchorMarket, &empty_anchor_market);

        let empty_settled: Map<u32, bool> = Map::new(&env);
        env.storage().instance().set(&DataKey::MarketSettled, &empty_settled);

        Self::bump_ttl(&env);
    }

    /// Anchor registers itself for a specific market before it can stake.
    /// The anchor's address must sign this call.
    pub fn register_anchor(env: Env, anchor: Address, market_id: u32) {
        anchor.require_auth();

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

    /// Anchor deposits USDC as a confidence stake against its own market.
    ///
    /// Economic incentive: if the market expires without a failure (NO wins),
    /// the anchor gets its stake back plus a share of premiums earned by NO holders.
    /// If YES wins (anchor failed), the staked USDC is used to pay YES holders.
    pub fn stake(env: Env, anchor: Address, amount: i128) {
        anchor.require_auth();
        assert!(amount > 0, "amount must be positive");

        let anchor_market: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMarket)
            .unwrap_or(Map::new(&env));
        assert!(
            anchor_market.contains_key(anchor.clone()),
            "anchor not registered — call register_anchor first"
        );

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();

        // Pull USDC from anchor into this contract
        token::Client::new(&env, &usdc)
            .transfer(&anchor, &env.current_contract_address(), &amount);

        // Update stake balance
        let mut stakes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Stakes)
            .unwrap_or(Map::new(&env));
        let current = stakes.get(anchor.clone()).unwrap_or(0);
        stakes.set(anchor.clone(), current + amount);
        env.storage().instance().set(&DataKey::Stakes, &stakes);

        // Compute and emit updated ACR
        let market_id = anchor_market.get(anchor.clone()).unwrap();
        let acr = Self::compute_acr_internal(&env, &anchor, &stakes, market_id);
        events::emit_stake(&env, &anchor, amount, acr);
        Self::bump_ttl(&env);
    }

    /// Anchor withdraws stake after the market has settled or expired.
    pub fn unstake(env: Env, anchor: Address, amount: i128) {
        anchor.require_auth();
        assert!(amount > 0, "amount must be positive");

        // Ensure the anchor's market has settled before allowing unstake
        let anchor_market: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMarket)
            .unwrap_or(Map::new(&env));
        let market_id = anchor_market
            .get(anchor.clone())
            .expect("anchor not registered");

        let settled_map: Map<u32, bool> = env
            .storage()
            .instance()
            .get(&DataKey::MarketSettled)
            .unwrap_or(Map::new(&env));
        assert!(
            settled_map.contains_key(market_id),
            "market not yet settled — cannot unstake"
        );

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();

        let mut stakes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Stakes)
            .unwrap_or(Map::new(&env));
        let current = stakes.get(anchor.clone()).unwrap_or(0);
        assert!(current >= amount, "insufficient stake balance");

        stakes.set(anchor.clone(), current - amount);
        env.storage().instance().set(&DataKey::Stakes, &stakes);

        // Return USDC to anchor
        token::Client::new(&env, &usdc)
            .transfer(&env.current_contract_address(), &anchor, &amount);

        events::emit_unstake(&env, &anchor, amount);
        Self::bump_ttl(&env);
    }

    // -------------------------------------------------------------------------
    // Called by insurance-market contracts (cross-contract)
    // -------------------------------------------------------------------------

    /// Called by insurance-market when YES tokens are minted (cover increases)
    /// or redeemed after settlement (cover decreases).
    ///
    /// In production: verify the caller is the registered market contract for market_id.
    /// MVP: any caller accepted — tighten in v2.
    pub fn update_cover_outstanding(env: Env, market_id: u32, delta: i128, increase: bool) {
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

    /// Called by insurance-market when a market reaches final state.
    /// Records the settlement so anchors can unstake.
    pub fn on_market_settled(env: Env, market_id: u32, yes_won: bool) {
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
    // Public read functions (callable by any contract, wallet, or DeFi protocol)
    // -------------------------------------------------------------------------

    /// THE KEY PUBLIC FUNCTION.
    ///
    /// Returns the Anchor Confidence Ratio (ACR) for an anchor in basis points.
    ///   - 0     = anchor has no stake or is not registered
    ///   - 10000 = ACR 1.00 (anchor staked USDC equals total cover outstanding)
    ///   - 20000 = ACR 2.00 (anchor staked double the cover — exceptional)
    ///
    /// ACR = (anchor_staked_usdc / total_yes_tokens_outstanding) * 10_000
    pub fn get_acr(env: Env, anchor: Address) -> i128 {
        let stakes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Stakes)
            .unwrap_or(Map::new(&env));
        let anchor_market: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMarket)
            .unwrap_or(Map::new(&env));

        let market_id = match anchor_market.get(anchor.clone()) {
            None => return 0,
            Some(id) => id,
        };

        Self::compute_acr_internal(&env, &anchor, &stakes, market_id)
    }

    /// Returns all registered anchors and their ACR scores.
    /// Output: Vec of (anchor_address, acr_bps) tuples.
    pub fn get_all_acr(env: Env) -> Vec<(Address, i128)> {
        let stakes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Stakes)
            .unwrap_or(Map::new(&env));
        let anchor_market: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::AnchorMarket)
            .unwrap_or(Map::new(&env));

        let mut results = Vec::new(&env);
        let anchors = stakes.keys();
        for i in 0..anchors.len() {
            let anchor = anchors.get(i).unwrap();
            if let Some(market_id) = anchor_market.get(anchor.clone()) {
                let acr = Self::compute_acr_internal(&env, &anchor, &stakes, market_id);
                results.push_back((anchor, acr));
            }
        }
        results
    }

    /// Returns the raw stake amount for an anchor (in USDC stroops).
    pub fn get_stake(env: Env, anchor: Address) -> i128 {
        let stakes: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Stakes)
            .unwrap_or(Map::new(&env));
        stakes.get(anchor).unwrap_or(0)
    }

    /// Returns the total YES tokens outstanding for a market (= total cover sold).
    pub fn get_cover_outstanding(env: Env, market_id: u32) -> i128 {
        let market_cover: Map<u32, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MarketCoverOut)
            .unwrap_or(Map::new(&env));
        market_cover.get(market_id).unwrap_or(0)
    }

    /// Bumps TTL to keep the contract storage alive.
    /// Anyone can call this to refresh the contract.
    pub fn extend_ttl(env: Env) {
        Self::bump_ttl(&env);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    fn compute_acr_internal(
        env: &Env,
        anchor: &Address,
        stakes: &Map<Address, i128>,
        market_id: u32,
    ) -> i128 {
        let staked = stakes.get(anchor.clone()).unwrap_or(0);

        let market_cover: Map<u32, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MarketCoverOut)
            .unwrap_or(Map::new(env));
        let cover_out = market_cover.get(market_id).unwrap_or(0);

        if cover_out == 0 {
            // No cover has been sold yet.
            // Return full ACR_PRECISION if anchor has staked, 0 otherwise.
            return if staked > 0 { ACR_PRECISION } else { 0 };
        }

        // ACR = (staked * 10_000) / cover_outstanding
        (staked * ACR_PRECISION) / cover_out
    }

    fn bump_ttl(env: &Env) {
        // Extend instance storage TTL: min 100k ledgers, target 200k ledgers
        env.storage().instance().extend_ttl(100_000, 200_000);
    }
}

mod test;
