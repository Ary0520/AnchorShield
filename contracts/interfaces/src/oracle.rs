use soroban_sdk::{contractclient, contracttype, Address, Env, Symbol, Vec};

/// SEP-40 oracle standard interface.
///
/// Price is 14-decimal fixed point: 100_000_000_000_000 = $1.00
/// Timestamp is Unix seconds (u64).
#[contracttype]
#[derive(Clone, Debug)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

#[contractclient(name = "OracleClient")]
pub trait OracleTrait {
    /// Return the base asset the price is reported in
    fn base(env: Env) -> Asset;

    /// Return all assets quoted by the price feed
    fn assets(env: Env) -> Vec<Asset>;

    /// Return the number of decimals for all assets quoted by the oracle
    fn decimals(env: Env) -> u32;

    /// Return default tick period timeframe (in seconds)
    fn resolution(env: Env) -> u32;

    /// Get price in base asset at specific timestamp
    fn price(env: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;

    /// Get last N price records
    fn prices(env: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>>;

    /// Get the most recent price for an asset
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceData {
    pub price: i128,    // price * 10^decimals (14 decimals typical)
    pub timestamp: u64, // Unix timestamp seconds
}
