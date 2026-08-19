use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug)]
pub struct AnchorMetrics {
    pub success_rate_bps: u32,       // e.g., 9950 = 99.5%
    pub avg_latency_seconds: u32,    // e.g., 120 = 2 mins
    pub failed_withdrawals: u32,     // e.g., 14
    pub oracle_uptime_bps: u32,      // e.g., 9999 = 99.99%
    pub historical_payouts: i128,    // Total USDC payouts funded
}

impl Default for AnchorMetrics {
    fn default() -> Self {
        Self {
            success_rate_bps: 10_000,
            avg_latency_seconds: 0,
            failed_withdrawals: 0,
            oracle_uptime_bps: 10_000,
            historical_payouts: 0,
        }
    }
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Factory,
    Usdc,
    /// Map<Address, AnchorMetrics> — anchor address → operational metrics
    AnchorMetricsMap,
    /// Map<u32, i128> — market_id → YES tokens outstanding (total cover sold)
    MarketCoverOut,
    /// Map<Address, u32> — anchor address → their registered market_id
    AnchorMarket,
    /// Map<u32, bool> — market_id → has settled?
    MarketSettled,
}
