use soroban_sdk::{contractevent, Address, Env};

#[contractevent]
pub struct MarketCreated {
    pub market_id: u32,
    pub market_contract: Address,
}

pub fn emit_market_created(env: &Env, market_id: u32, market_contract: &Address) {
    MarketCreated {
        market_id,
        market_contract: market_contract.clone(),
    }
    .publish(env);
}
