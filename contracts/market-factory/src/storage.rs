use soroban_sdk::{contracttype, Address, String, Symbol};
use interfaces::oracle::Asset;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Address — factory admin (only they can create markets)
    Admin,
    /// Map<u32, MarketConfig> — market_id → config
    Markets,
    /// u32 — next market ID to assign
    NextMarketId,
    /// BytesN<32> — WASM hash of the insurance-market contract
    /// Stored after `stellar contract upload`, used by factory to deploy instances
    InsuranceMarketHash,
    /// Address — the single shared anchor-stake contract
    AnchorStakeContract,
}

/// Full configuration for one market instance.
/// Stored in the factory and also passed to the insurance-market on initialization.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MarketConfig {
    pub market_id: u32,
    /// Human-readable label, e.g. "USDC depeg < $0.995 for 1hr"
    pub label: String,
    /// SAC address of the collateral token (USDC, EURC, etc.)
    pub collateral_token: Address,
    /// SEP-40 oracle asset: Asset::Other(Symbol) for USDC/EURC etc.
    pub covered_asset: Asset,
    /// SEP-40 oracle contract address
    pub oracle_contract: Address,
    /// Price below which a depeg is detected, 14-decimal fixed point
    /// $0.995 = 9_950_000_000_000_0 (i.e. 0.995 * 1e14)
    pub depeg_threshold: i128,
    /// How long the price must stay below threshold before settlement triggers (seconds)
    pub breach_duration_seconds: u64,
    /// Unix timestamp when market expires and NO winners can claim
    pub expiry_timestamp: u64,
    /// Some(address) for anchor-specific markets; None for generic stablecoin markets
    pub anchor_id: Option<Address>,
    /// Address of the deployed insurance-market contract for this market
    /// (populated after create_market runs)
    pub market_contract: Address,
}
