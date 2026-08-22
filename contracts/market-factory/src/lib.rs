#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, BytesN, Env, Map, String, Vec,
};

use interfaces::insurance_market::InsuranceMarketClient;
use interfaces::oracle::Asset;
use crate::storage::{DataKey, MarketConfig};

mod events;
mod storage;

#[contract]
pub struct MarketFactory;

#[contractimpl]
impl MarketFactory {
    // ─────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────

    /// Called once at deployment.
    ///
    /// insurance_market_wasm_hash: the WASM hash returned by `stellar contract upload`
    ///   for the insurance-market contract. Factory uses this to deploy fresh instances.
    pub fn initialize(
        env: Env,
        admin: Address,
        insurance_market_wasm_hash: BytesN<32>,
        anchor_stake_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::InsuranceMarketHash, &insurance_market_wasm_hash);
        env.storage()
            .instance()
            .set(&DataKey::AnchorStakeContract, &anchor_stake_contract);
        env.storage().instance().set(&DataKey::NextMarketId, &0u32);

        let markets: Map<u32, MarketConfig> = Map::new(&env);
        env.storage().instance().set(&DataKey::Markets, &markets);

        Self::bump_ttl(&env);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin functions
    // ─────────────────────────────────────────────────────────────────────────

    /// Creates a new insurance market by deploying a fresh insurance-market contract
    /// instance and initializing it with the provided parameters.
    ///
    /// Only the factory admin can call this.
    /// Returns the new market_id (increments monotonically from 0).
    ///
    /// Deployment uses a deterministic salt based on market_id, so each
    /// market has a predictable contract address.
    pub fn create_market(
        env: Env,
        label: String,
        collateral_token: Address,
        covered_asset: Asset,
        oracle_contract: Address,
        depeg_threshold: i128,
        breach_duration_seconds: u64,
        expiry_timestamp: u64,
        anchor_id: Option<Address>,
    ) -> u32 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        assert!(depeg_threshold > 0, "depeg_threshold must be positive");
        assert!(breach_duration_seconds > 0, "breach_duration must be positive");
        assert!(
            expiry_timestamp > env.ledger().timestamp(),
            "expiry must be in the future"
        );

        let market_id: u32 = env.storage().instance().get(&DataKey::NextMarketId).unwrap();
        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::InsuranceMarketHash)
            .unwrap();
        let anchor_stake: Address = env
            .storage()
            .instance()
            .get(&DataKey::AnchorStakeContract)
            .unwrap();

        // Deterministic salt: sha256 of market_id bytes
        // This makes the insurance-market contract address predictable
        let salt = env
            .crypto()
            .sha256(&soroban_sdk::Bytes::from_slice(&env, &market_id.to_be_bytes()));

        // Deploy a fresh insurance-market contract instance.
        // Second arg to deploy_v2 is Vec<Val> of constructor args.
        // Our insurance-market uses initialize() not __constructor, so pass empty vec.
        let market_contract = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, soroban_sdk::Vec::<soroban_sdk::Val>::new(&env));

        // Initialize the deployed market contract via cross-contract call
        InsuranceMarketClient::new(&env, &market_contract).initialize(
            &market_id,
            &label,
            &collateral_token,
            &covered_asset,
            &oracle_contract,
            &depeg_threshold,
            &breach_duration_seconds,
            &expiry_timestamp,
            &anchor_id,
            &anchor_stake,
        );

        // Store the market config in the factory
        let mut markets: Map<u32, MarketConfig> = env
            .storage()
            .instance()
            .get(&DataKey::Markets)
            .unwrap();

        let config = MarketConfig {
            market_id,
            label,
            collateral_token,
            covered_asset,
            oracle_contract,
            depeg_threshold,
            breach_duration_seconds,
            expiry_timestamp,
            anchor_id,
            market_contract: market_contract.clone(),
        };
        markets.set(market_id, config);
        env.storage().instance().set(&DataKey::Markets, &markets);
        env.storage()
            .instance()
            .set(&DataKey::NextMarketId, &(market_id + 1));

        events::emit_market_created(&env, market_id, &market_contract);
        Self::bump_ttl(&env);
        market_id
    }

    /// Allows admin to update the WASM hash (e.g., for contract upgrades).
    /// All subsequent markets will use the new WASM. Existing markets are unaffected.
    pub fn update_wasm_hash(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::InsuranceMarketHash, &new_wasm_hash);
        Self::bump_ttl(&env);
    }

    /// Allows admin to remove a market from the factory registry.
    pub fn delete_market(env: Env, market_id: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut markets: Map<u32, MarketConfig> = env
            .storage()
            .instance()
            .get(&DataKey::Markets)
            .unwrap();
        
        if markets.contains_key(market_id) {
            markets.remove(market_id);
            env.storage().instance().set(&DataKey::Markets, &markets);
        }
        Self::bump_ttl(&env);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /// Returns the full MarketConfig for a given market_id.
    pub fn get_market(env: Env, market_id: u32) -> MarketConfig {
        let markets: Map<u32, MarketConfig> = env
            .storage()
            .instance()
            .get(&DataKey::Markets)
            .unwrap();
        markets.get(market_id).expect("market not found")
    }

    /// Returns just the contract address for a given market_id.
    pub fn get_market_contract(env: Env, market_id: u32) -> Address {
        Self::get_market(env, market_id).market_contract
    }

    /// Returns all market IDs that have been created.
    pub fn list_markets(env: Env) -> Vec<u32> {
        let markets: Map<u32, MarketConfig> = env
            .storage()
            .instance()
            .get(&DataKey::Markets)
            .unwrap_or(Map::new(&env));
        markets.keys()
    }

    /// Returns the factory admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Returns the anchor-stake contract address.
    pub fn get_anchor_stake_contract(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::AnchorStakeContract)
            .unwrap()
    }

    /// Bumps instance TTL. Anyone can call this to keep the contract alive.
    pub fn extend_ttl(env: Env) {
        Self::bump_ttl(&env);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    fn bump_ttl(env: &Env) {
        env.storage().instance().extend_ttl(100_000, 200_000);
    }
}

mod test;
