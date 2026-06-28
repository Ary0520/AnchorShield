use soroban_sdk::{Address, Env};

/// MVP stub: USDC is held directly in the contract.
///
/// Post-MVP integration plan:
///   1. Store DeFindex vault address in DataKey::DefindexShares (as vault address)
///   2. On deposit: call defindex_vault.deposit(&[amount], &amount, &true)
///      and store the returned shares in DataKey::DefindexShares
///   3. On withdraw: call defindex_vault.withdraw(&shares, &[amount], &false)
///      to recover principal + yield
///   4. Route yield above principal to a protocol fee address
///
/// Reference: https://deepwiki.com/paltalabs/defindex
pub fn deposit_to_defindex(_env: &Env, _collateral: &Address, _amount: i128) {
    // No-op for MVP: USDC stays in contract balance
}

/// MVP stub: USDC is already in the contract, nothing to withdraw from vault.
pub fn withdraw_from_defindex(_env: &Env, _collateral: &Address, _amount: i128) {
    // No-op for MVP
}
