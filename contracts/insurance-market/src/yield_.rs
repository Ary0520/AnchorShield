use soroban_sdk::{vec, Address, Env, IntoVal, Symbol, Vec};
use crate::storage::DataKey;

pub fn deposit_to_defindex(env: &Env, _collateral: &Address, amount: i128) {
    if amount <= 0 {
        return;
    }
    // Check if Yield Vault is configured
    if let Some(vault) = env.storage().instance().get::<_, Address>(&DataKey::YieldVault) {
        let amounts_desired: Vec<i128> = vec![&env, amount];
        let amounts_min: Vec<i128> = vec![&env, 0];
        let from: Address = env.current_contract_address();
        let invest: bool = true;

        // We must authorize the vault to pull USDC from us!
        env.authorize_as_current_contract(vec![
            &env,
            soroban_sdk::auth::InvokerContractAuthEntry::Contract(
                soroban_sdk::auth::SubContractInvocation {
                    context: soroban_sdk::auth::ContractContext {
                        contract: _collateral.clone(),
                        fn_name: Symbol::new(env, "transfer"),
                        args: (
                            env.current_contract_address(),
                            vault.clone(),
                            amount,
                        )
                            .into_val(env),
                    },
                    sub_invocations: vec![&env],
                },
            ),
        ]);

        let res = env.try_invoke_contract::<(Vec<i128>, i128, soroban_sdk::Val), soroban_sdk::Error>(
            &vault,
            &Symbol::new(env, "deposit"),
            (amounts_desired, amounts_min, from, invest).into_val(env),
        );

        if let Ok(Ok(success_res)) = res {
            let minted_shares = success_res.1;
            let mut total_shares: i128 = env.storage().instance().get(&DataKey::DefindexShares).unwrap_or(0);
            total_shares += minted_shares;
            env.storage().instance().set(&DataKey::DefindexShares, &total_shares);
        }
        // If it fails, we gracefully do nothing. The USDC remains in our contract balance.
    }
}

pub fn withdraw_from_defindex(env: &Env, _collateral: &Address, _amount: i128) {
    // We withdraw ALL shares we own when settling the market.
    if let Some(vault) = env.storage().instance().get::<_, Address>(&DataKey::YieldVault) {
        let shares: i128 = env.storage().instance().get(&DataKey::DefindexShares).unwrap_or(0);
        if shares > 0 {
            let df_amount: i128 = shares;
            let min_amounts_out: Vec<i128> = vec![&env, 0];
            let from: Address = env.current_contract_address();

            let _res = env.try_invoke_contract::<Vec<i128>, soroban_sdk::Error>(
                &vault,
                &Symbol::new(env, "withdraw"),
                (df_amount, min_amounts_out, from).into_val(env),
            );

            env.storage().instance().set(&DataKey::DefindexShares, &0i128);
        }
    }
}
