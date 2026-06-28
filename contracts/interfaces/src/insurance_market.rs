use soroban_sdk::{contractclient, Address, Env, String, Symbol};

/// Minimal interface for InsuranceMarket — used by market-factory to call
/// initialize() on a freshly deployed insurance-market contract instance.
#[contractclient(name = "InsuranceMarketClient")]
pub trait InsuranceMarketTrait {
    fn initialize(
        env: Env,
        market_id: u32,
        label: String,
        collateral_token: Address,
        covered_asset_symbol: Symbol,
        oracle_contract: Address,
        depeg_threshold: i128,
        breach_duration_seconds: u64,
        expiry_timestamp: u64,
        anchor_id: Option<Address>,
        anchor_stake_contract: Address,
    );
}
