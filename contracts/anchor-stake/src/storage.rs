use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Factory,
    Usdc,
    /// Map<Address, i128> — anchor address → staked USDC amount
    Stakes,
    /// Map<u32, i128> — market_id → YES tokens outstanding (total cover sold)
    MarketCoverOut,
    /// Map<Address, u32> — anchor address → their registered market_id
    AnchorMarket,
    /// Map<u32, bool> — market_id → has settled?
    MarketSettled,
}
