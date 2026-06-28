use soroban_sdk::{contractevent, Address, Env};

// ── Event definitions ─────────────────────────────────────────────────────
// #[contractevent] generates a .publish(&env) method on the struct.
// The struct's snake_case name becomes the first topic automatically.

#[contractevent]
pub struct AnchorRegistered {
    #[topic]
    pub anchor: Address,
    pub market_id: u32,
}

#[contractevent]
pub struct AnchorStaked {
    #[topic]
    pub anchor: Address,
    pub amount: i128,
    pub acr_bps: i128,
}

#[contractevent]
pub struct AnchorUnstaked {
    #[topic]
    pub anchor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MarketSettledAnchor {
    pub market_id: u32,
    pub yes_won: bool,
}

// ── Emit helpers ──────────────────────────────────────────────────────────

pub fn emit_anchor_registered(env: &Env, anchor: &Address, market_id: u32) {
    AnchorRegistered {
        anchor: anchor.clone(),
        market_id,
    }
    .publish(env);
}

pub fn emit_stake(env: &Env, anchor: &Address, amount: i128, acr_bps: i128) {
    AnchorStaked {
        anchor: anchor.clone(),
        amount,
        acr_bps,
    }
    .publish(env);
}

pub fn emit_unstake(env: &Env, anchor: &Address, amount: i128) {
    AnchorUnstaked {
        anchor: anchor.clone(),
        amount,
    }
    .publish(env);
}

pub fn emit_market_settled(env: &Env, market_id: u32, yes_won: bool) {
    MarketSettledAnchor { market_id, yes_won }.publish(env);
}
