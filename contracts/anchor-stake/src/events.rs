use soroban_sdk::{contractevent, Address, Env};

#[contractevent]
pub struct AnchorRegistered {
    #[topic]
    pub anchor: Address,
    pub market_id: u32,
}

#[contractevent]
pub struct AnchorMetricsUpdated {
    #[topic]
    pub anchor: Address,
    pub acr_bps: i128,
}

#[contractevent]
pub struct MarketSettledAnchor {
    pub market_id: u32,
    pub yes_won: bool,
}

pub fn emit_anchor_registered(env: &Env, anchor: &Address, market_id: u32) {
    AnchorRegistered {
        anchor: anchor.clone(),
        market_id,
    }
    .publish(env);
}

pub fn emit_metrics_updated(env: &Env, anchor: &Address, acr_bps: i128) {
    AnchorMetricsUpdated {
        anchor: anchor.clone(),
        acr_bps,
    }
    .publish(env);
}

pub fn emit_market_settled(env: &Env, market_id: u32, yes_won: bool) {
    MarketSettledAnchor { market_id, yes_won }.publish(env);
}
