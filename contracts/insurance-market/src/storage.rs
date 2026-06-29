use soroban_sdk::{contracttype, Address};

// ─── Market state ───────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MarketState {
    /// Market is active — underwriting and trading are open
    Open,
    /// YES won: depeg breach confirmed — YES holders claim $1 USDC per token
    Settled,
    /// NO won: market expired without breach — NO holders claim $1 USDC per token
    Expired,
}

// ─── Order book ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct Order {
    pub order_id: u64,
    pub owner: Address,
    /// true = buying YES tokens (buying insurance cover), paying USDC
    /// false = selling YES tokens (underwriter collecting premium)
    pub is_buy: bool,
    /// Price in basis points: 0–10000, where 10000 = $1.00 USDC per YES token
    /// e.g. price_bps = 150 means the buyer pays $0.015 per token = 1.5% premium
    pub price_bps: i64,
    /// Total number of YES tokens in this order
    pub amount: i128,
    /// How many tokens have already been filled
    pub filled: i128,
}

// ─── Storage keys ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // ── Immutable config (set in initialize, never changed) ──────────────────
    MarketId,
    Label,
    CollateralToken,       // Address — USDC SAC address
    CoveredAsset,          // Asset (from oracle interface) — the asset being insured
    OracleContract,        // Address — SEP-40 contract
    DepegThreshold,        // i128 — e.g. 9_950_000_000_000_0 for $0.995 (14 decimals)
    BreachDurationSeconds, // u64 — e.g. 3600 for 1 hour
    ExpiryTimestamp,       // u64 — Unix seconds when market expires
    AnchorId,              // Option<Address> — set for anchor-specific markets
    AnchorStakeContract,   // Address — the shared anchor-stake contract

    // ── Mutable state ────────────────────────────────────────────────────────
    State,               // MarketState
    TotalCollateral,     // i128 — total USDC locked in this market
    TotalYes,            // i128 — total YES tokens minted
    TotalNo,             // i128 — total NO tokens minted
    BreachStartedAt,     // Option<u64> — ledger timestamp when depeg was first detected
    SettledFor,          // Option<bool> — Some(true)=YES wins, Some(false)=NO wins

    // ── Per-account token balances (persistent storage with per-entry TTL) ───
    YesBalance(Address), // i128
    NoBalance(Address),  // i128

    // ── Order book ───────────────────────────────────────────────────────────
    Orders,      // Map<u64, Order>
    NextOrderId, // u64

    // ── DeFindex yield tracking (for post-MVP) ───────────────────────────────
    DefindexShares, // i128 — vault shares held (0 for MVP)
}
