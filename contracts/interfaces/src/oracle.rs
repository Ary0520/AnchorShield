use soroban_sdk::{contractclient, contracttype, Env, Symbol, Vec};

/// SEP-40 oracle standard interface.
/// RedStone Finance implements this on Stellar mainnet.
///
/// Price is 14-decimal fixed point: 100_000_000_000_000 = $1.00
/// Timestamp is Unix seconds (u64).
#[contractclient(name = "OracleClient")]
pub trait OracleTrait {
    /// Returns latest price for the given asset symbol (e.g. "USDC", "EURC").
    fn lastprice(env: Env, asset: Symbol) -> Option<PriceData>;

    /// Returns the number of decimals the oracle uses (14 for RedStone).
    fn decimals(env: Env) -> u32;

    /// Returns all supported asset symbols.
    fn assets(env: Env) -> Vec<Symbol>;
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceData {
    pub price: i128,    // price * 10^decimals (14 decimals for RedStone)
    pub timestamp: u64, // Unix timestamp seconds
}
