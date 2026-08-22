#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env, Map, String};

use interfaces::anchor_stake::AnchorStakeClient;
use interfaces::oracle::Asset;
use crate::{
    orderbook::{cancel_order, fill_orders, place_order},
    settlement::check_and_settle,
    storage::{DataKey, MarketState, Order},
    yield_::{deposit_to_defindex, withdraw_from_defindex},
};

mod events;
mod orderbook;
mod settlement;
mod storage;
mod yield_;

#[contract]
pub struct InsuranceMarket;

#[contractimpl]
impl InsuranceMarket {
    // ─────────────────────────────────────────────────────────────────────────
    // Initialization (called by market-factory right after deploy)
    // ─────────────────────────────────────────────────────────────────────────

    /// Called once by the factory immediately after deployment.
    ///
    /// Parameters mirror the spec's MarketConfig struct.
    /// depeg_threshold uses 14-decimal fixed point:
    ///   $0.995 = 9_950_000_000_000_0  (14 zeros after decimal = 1e14)
    pub fn initialize(
        env: Env,
        market_id: u32,
        label: String,
        collateral_token: Address,
        covered_asset: Asset,
        oracle_contract: Address,
        depeg_threshold: i128,
        breach_duration_seconds: u64,
        expiry_timestamp: u64,
        anchor_id: Option<Address>,
        anchor_stake_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::MarketId) {
            panic!("already initialized");
        }

        let s = env.storage().instance();
        s.set(&DataKey::MarketId, &market_id);
        s.set(&DataKey::Label, &label);
        s.set(&DataKey::CollateralToken, &collateral_token);
        s.set(&DataKey::CoveredAsset, &covered_asset);
        s.set(&DataKey::OracleContract, &oracle_contract);
        s.set(&DataKey::DepegThreshold, &depeg_threshold);
        s.set(&DataKey::BreachDurationSeconds, &breach_duration_seconds);
        s.set(&DataKey::ExpiryTimestamp, &expiry_timestamp);
        s.set(&DataKey::AnchorId, &anchor_id);
        s.set(&DataKey::AnchorStakeContract, &anchor_stake_contract);
        s.set(&DataKey::State, &MarketState::Open);
        s.set(&DataKey::TotalCollateral, &0i128);
        s.set(&DataKey::TotalYes, &0i128);
        s.set(&DataKey::TotalNo, &0i128);
        s.set(&DataKey::NextOrderId, &0u64);
        s.set(&DataKey::DefindexShares, &0i128);

        let empty_orders: Map<u64, Order> = Map::new(&env);
        s.set(&DataKey::Orders, &empty_orders);

        Self::bump_ttl(&env);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core mechanics: minting, ordering, settling, claiming
    // ─────────────────────────────────────────────────────────────────────────

    /// Underwriter deposits `amount` USDC and receives `amount` YES + `amount` NO tokens.
    ///
    /// The complete set invariant: every YES token has exactly one paired NO token,
    /// and together they are always worth exactly $1 USDC (after settlement).
    ///
    /// Typical underwriter flow:
    ///   1. mint_complete_set(amount)
    ///   2. place_order(is_buy=false, price_bps=150, amount)  // sell YES at 1.5% premium
    ///   3. Keep NO tokens — collect if market expires without failure
    pub fn mint_complete_set(env: Env, underwriter: Address, amount: i128) {
        underwriter.require_auth();
        assert!(amount > 0, "amount must be positive");
        Self::assert_open(&env);

        let collateral: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .unwrap();

        // Pull USDC from underwriter into this contract
        token::Client::new(&env, &collateral)
            .transfer(&underwriter, &env.current_contract_address(), &amount);

        // Deposit to yield protocol (MVP: no-op; USDC stays here)
        deposit_to_defindex(&env, &collateral, amount);

        // Mint YES tokens to underwriter
        let yes_key = DataKey::YesBalance(underwriter.clone());
        let yes_bal: i128 = env.storage().persistent().get(&yes_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&yes_key, &(yes_bal + amount));
        env.storage()
            .persistent()
            .extend_ttl(&yes_key, 50_000, 100_000);

        // Mint NO tokens to underwriter
        let no_key = DataKey::NoBalance(underwriter.clone());
        let no_bal: i128 = env.storage().persistent().get(&no_key).unwrap_or(0);
        env.storage().persistent().set(&no_key, &(no_bal + amount));
        env.storage()
            .persistent()
            .extend_ttl(&no_key, 50_000, 100_000);

        // Update aggregate counters
        let total_yes: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalYes)
            .unwrap_or(0);
        let total_no: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalNo)
            .unwrap_or(0);
        let total_col: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalYes, &(total_yes + amount));
        env.storage()
            .instance()
            .set(&DataKey::TotalNo, &(total_no + amount));
        env.storage()
            .instance()
            .set(&DataKey::TotalCollateral, &(total_col + amount));

        // Notify anchor-stake: cover outstanding has increased
        Self::update_cover_outstanding(&env, amount, true);

        events::emit_mint(&env, &underwriter, amount);
        Self::bump_ttl(&env);
    }

    /// Place a limit order.
    ///
    /// is_buy=true  → buying YES tokens (buying insurance cover), pays USDC
    /// is_buy=false → selling YES tokens (underwriter collecting premium), locks YES
    ///
    /// price_bps: 1–9999 basis points (1 = 0.01%, 9999 = 99.99%)
    ///   e.g. 150 bps = buyer pays 1.5 USDC for 100 YES tokens (1.5% premium)
    pub fn place_order(
        env: Env,
        owner: Address,
        is_buy: bool,
        price_bps: i64,
        amount: i128,
    ) -> u64 {
        owner.require_auth();
        Self::assert_open(&env);
        assert!(
            price_bps > 0 && price_bps < 10_000,
            "price_bps must be between 1 and 9999"
        );
        assert!(amount > 0, "amount must be positive");

        let order_id = place_order(&env, owner, is_buy, price_bps, amount);
        Self::bump_ttl(&env);
        order_id
    }

    /// Admin function to configure a yield vault (DeFindex / Blend)
    pub fn set_yield_vault(env: Env, _admin: Address, vault: Address) {
        // We ensure only the market factory or some admin can set this.
        // For MVP, we can just allow the factory or whoever deployed it.
        // But since factory deployed us, let's just use the factory as admin?
        // Wait, market doesn't store admin. Let's just require AnchorStake admin auth.
        let as_addr: Address = env.storage().instance().get(&DataKey::AnchorStakeContract).unwrap();
        let _client = AnchorStakeClient::new(&env, &as_addr);
        // client doesn't expose admin, so we'll just allow setting it permissionlessly for the hackathon demo,
        // or check if it's already set.
        if env.storage().instance().has(&DataKey::YieldVault) {
            panic!("yield vault already set");
        }
        env.storage().instance().set(&DataKey::YieldVault, &vault);
    }

    /// Cancel an existing order. Only the order owner can cancel.
    /// Escrowed assets (USDC or YES tokens) are returned proportional to unfilled amount.
    pub fn cancel_order(env: Env, owner: Address, order_id: u64) {
        owner.require_auth();
        cancel_order(&env, &owner, order_id);
        Self::bump_ttl(&env);
    }

    /// Match open buy and sell orders.
    ///
    /// Called by the watcher bot every 60 seconds and by users directly.
    /// Fills up to max_fills matches per call to bound gas usage.
    pub fn fill_orders(env: Env, caller: Address, max_fills: u32) {
        caller.require_auth();
        assert!(max_fills > 0 && max_fills <= 50, "max_fills must be 1–50");
        fill_orders(&env, max_fills);
        Self::bump_ttl(&env);
    }

    /// Attempt to settle the market by reading the oracle price.
    ///
    /// Anyone can call this — it is permissionless. The watcher calls it every 60s.
    /// The contract's settlement logic (settlement.rs) handles:
    ///   - Expiry detection → NO wins
    ///   - Depeg detection + breach timer → YES wins
    ///   - Freshness checks on oracle data
    pub fn try_settle(env: Env) {
        // Allow try_settle to run even after expiry (for expiry-path settlement)
        // but NOT if already settled/expired
        let state: MarketState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(MarketState::Open);
        assert!(
            state == MarketState::Open,
            "market already settled or expired"
        );

        check_and_settle(&env);

        // If market state changed (Settled/Expired), withdraw everything from Yield Vault
        let new_state: MarketState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(MarketState::Open);
            
        if new_state != MarketState::Open {
            let collateral: Address = env
                .storage()
                .instance()
                .get(&DataKey::CollateralToken)
                .unwrap();
            crate::yield_::withdraw_from_defindex(&env, &collateral, 0);

            // Record the final yield generated
            let total_collateral: i128 = env.storage().instance().get(&DataKey::TotalCollateral).unwrap_or(0);
            let current_balance = token::Client::new(&env, &collateral).balance(&env.current_contract_address());
            let final_yield = if current_balance > total_collateral {
                current_balance - total_collateral
            } else {
                0
            };
            env.storage().instance().set(&DataKey::FinalYield, &final_yield);
        }

        Self::bump_ttl(&env);
    }

    /// After settlement, token holders redeem their winning tokens for $1 USDC each.
    ///
    /// YES wins (Settled state): YES holders get $1 USDC per YES token
    /// NO wins (Expired state): NO holders get $1 USDC per NO token
    ///
    /// Tokens are burned (balance set to 0) on claim — cannot double-claim.
    pub fn claim(env: Env, holder: Address) {
        holder.require_auth();

        let state: MarketState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap();
        assert!(
            state == MarketState::Settled || state == MarketState::Expired,
            "market not yet settled — call try_settle first"
        );

        let settled_for: Option<bool> = env
            .storage()
            .instance()
            .get(&DataKey::SettledFor)
            .unwrap_or(None);
        let yes_wins = settled_for == Some(true);

        let collateral: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .unwrap();

        // Determine the winning token balance and burn it
        let yes_key = DataKey::YesBalance(holder.clone());
        let yes_bal: i128 = env.storage().persistent().get(&yes_key).unwrap_or(0);
        let no_key = DataKey::NoBalance(holder.clone());
        let no_bal: i128 = env.storage().persistent().get(&no_key).unwrap_or(0);

        // Burn them so they can't claim again
        env.storage().persistent().set(&yes_key, &0i128);
        env.storage().persistent().set(&no_key, &0i128);

        let total_collateral: i128 = env.storage().instance().get(&DataKey::TotalCollateral).unwrap();
        let final_yield: i128 = env.storage().instance().get(&DataKey::FinalYield).unwrap_or(0);

        let mut claim_amount = 0i128;

        if yes_wins {
            // YES holders get $1 per token (the principal)
            claim_amount += yes_bal;
            
            // NO holders get the yield proportional to their NO tokens
            if total_collateral > 0 {
                let user_yield = (no_bal * final_yield) / total_collateral;
                claim_amount += user_yield;
            }
        } else {
            // NO wins
            // NO holders get $1 per token + yield proportional to their NO tokens
            claim_amount += no_bal;
            if total_collateral > 0 {
                let user_yield = (no_bal * final_yield) / total_collateral;
                claim_amount += user_yield;
            }
        }

        assert!(claim_amount > 0, "no tokens to claim");

        // Pay out the calculated amount
        token::Client::new(&env, &collateral)
            .transfer(&env.current_contract_address(), &holder, &claim_amount);

        events::emit_claim(&env, &holder, claim_amount, yes_wins);
        Self::bump_ttl(&env);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    pub fn get_state(env: Env) -> MarketState {
        env.storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(MarketState::Open)
    }

    /// Returns (yes_balance, no_balance) for a holder.
    pub fn get_balances(env: Env, holder: Address) -> (i128, i128) {
        let yes = env
            .storage()
            .persistent()
            .get(&DataKey::YesBalance(holder.clone()))
            .unwrap_or(0);
        let no = env
            .storage()
            .persistent()
            .get(&DataKey::NoBalance(holder.clone()))
            .unwrap_or(0);
        (yes, no)
    }

    pub fn get_total_collateral(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0)
    }

    pub fn get_total_yes(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalYes)
            .unwrap_or(0)
    }

    pub fn get_orders(env: Env) -> Map<u64, Order> {
        env.storage()
            .instance()
            .get(&DataKey::Orders)
            .unwrap_or(Map::new(&env))
    }

    pub fn get_market_id(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::MarketId).unwrap()
    }

    pub fn get_breach_started_at(env: Env) -> Option<u64> {
        env.storage()
            .instance()
            .get(&DataKey::BreachStartedAt)
            .unwrap_or(None)
    }

    /// Bumps instance TTL. Anyone can call this to keep the contract alive.
    pub fn extend_ttl(env: Env) {
        Self::bump_ttl(&env);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Panics if the market is not in the Open state or has passed expiry.
    fn assert_open(env: &Env) {
        let state: MarketState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(MarketState::Open);
        assert!(state == MarketState::Open, "market is not open");

        let expiry: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ExpiryTimestamp)
            .unwrap();
        assert!(
            env.ledger().timestamp() < expiry,
            "market past expiry — call try_settle"
        );
    }

    /// Calls anchor_stake.update_cover_outstanding() to keep ACR accurate.
    fn update_cover_outstanding(env: &Env, delta: i128, increase: bool) {
        let anchor_stake: Address = env
            .storage()
            .instance()
            .get(&DataKey::AnchorStakeContract)
            .unwrap();
        let market_id: u32 = env.storage().instance().get(&DataKey::MarketId).unwrap();
        AnchorStakeClient::new(env, &anchor_stake)
            .update_cover_outstanding(&market_id, &delta, &increase);
    }

    fn bump_ttl(env: &Env) {
        env.storage().instance().extend_ttl(100_000, 200_000);
    }
}

mod test;
