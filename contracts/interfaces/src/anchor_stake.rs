use soroban_sdk::{contractclient, Address, Env, Vec};

/// Interface for the AnchorStake contract (now operating as an Operational Risk Registry).
/// Used by insurance-market and market-factory to call it cross-contract.
#[contractclient(name = "AnchorStakeClient")]
pub trait AnchorStakeTrait {
    fn update_cover_outstanding(env: Env, market_id: u32, delta: i128, increase: bool);
    fn on_market_settled(env: Env, market_id: u32, yes_won: bool);
    fn get_acr(env: Env, anchor: Address) -> i128;
    fn get_all_acr(env: Env) -> Vec<(Address, i128)>;
    fn get_cover_outstanding(env: Env, market_id: u32) -> i128;
}
