use soroban_sdk::{contractevent, Address, Env};

// ── Event definitions ─────────────────────────────────────────────────────
// #[contractevent] generates a .publish(&env) method on each struct.

#[contractevent]
pub struct Minted {
    #[topic]
    pub underwriter: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Settled {
    pub market_id: u32,
    pub yes_wins: bool,
}

#[contractevent]
pub struct Claimed {
    #[topic]
    pub holder: Address,
    pub amount: i128,
    pub yes_wins: bool,
}

#[contractevent]
pub struct OrderPlaced {
    pub order_id: u64,
    pub is_buy: bool,
    pub price_bps: i64,
    pub amount: i128,
}

#[contractevent]
pub struct OrderCancelled {
    pub order_id: u64,
}

#[contractevent]
pub struct OrderFilled {
    pub buy_id: u64,
    pub sell_id: u64,
    pub fill_amount: i128,
    pub execution_price_bps: i64,
}

// ── Emit helpers ──────────────────────────────────────────────────────────

pub fn emit_mint(env: &Env, underwriter: &Address, amount: i128) {
    Minted {
        underwriter: underwriter.clone(),
        amount,
    }
    .publish(env);
}

pub fn emit_settled(env: &Env, market_id: u32, yes_wins: bool) {
    Settled { market_id, yes_wins }.publish(env);
}

pub fn emit_claim(env: &Env, holder: &Address, amount: i128, yes_wins: bool) {
    Claimed {
        holder: holder.clone(),
        amount,
        yes_wins,
    }
    .publish(env);
}

pub fn emit_order_placed(env: &Env, order_id: u64, is_buy: bool, price_bps: i64, amount: i128) {
    OrderPlaced {
        order_id,
        is_buy,
        price_bps,
        amount,
    }
    .publish(env);
}

pub fn emit_order_cancelled(env: &Env, order_id: u64) {
    OrderCancelled { order_id }.publish(env);
}

pub fn emit_order_filled(
    env: &Env,
    buy_id: u64,
    sell_id: u64,
    fill_amount: i128,
    execution_price_bps: i64,
) {
    OrderFilled {
        buy_id,
        sell_id,
        fill_amount,
        execution_price_bps,
    }
    .publish(env);
}
