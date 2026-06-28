use soroban_sdk::{token, Address, Env, Map};

use crate::storage::{DataKey, Order};

/// Places a limit order and escrows the required assets.
///
/// Buy orders (is_buy=true): escrow USDC = (amount * price_bps) / 10_000
/// Sell orders (is_buy=false): escrow YES tokens from the seller's balance
///
/// Returns the new order_id.
pub fn place_order(
    env: &Env,
    owner: Address,
    is_buy: bool,
    price_bps: i64,
    amount: i128,
) -> u64 {
    let collateral: Address = env
        .storage()
        .instance()
        .get(&DataKey::CollateralToken)
        .unwrap();

    if is_buy {
        // Escrow USDC from buyer immediately
        let cost = (amount * price_bps as i128) / 10_000;
        assert!(cost > 0, "order cost rounds to zero — increase amount or price");
        token::Client::new(env, &collateral)
            .transfer(&owner, &env.current_contract_address(), &cost);
    } else {
        // Escrow YES tokens from seller's balance
        let yes_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::YesBalance(owner.clone()))
            .unwrap_or(0);
        assert!(yes_bal >= amount, "insufficient YES tokens to place sell order");
        env.storage()
            .persistent()
            .set(&DataKey::YesBalance(owner.clone()), &(yes_bal - amount));
        // Bump TTL on this persistent entry
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::YesBalance(owner.clone()), 50_000, 100_000);
    }

    let order_id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextOrderId)
        .unwrap_or(0);

    let mut orders: Map<u64, Order> = env
        .storage()
        .instance()
        .get(&DataKey::Orders)
        .unwrap_or(Map::new(env));

    let order = Order {
        order_id,
        owner,
        is_buy,
        price_bps,
        amount,
        filled: 0,
    };
    orders.set(order_id, order);
    env.storage().instance().set(&DataKey::Orders, &orders);
    env.storage()
        .instance()
        .set(&DataKey::NextOrderId, &(order_id + 1));

    crate::events::emit_order_placed(env, order_id, is_buy, price_bps, amount);
    order_id
}

/// Cancels an order and returns escrowed assets to the owner.
pub fn cancel_order(env: &Env, owner: &Address, order_id: u64) {
    let mut orders: Map<u64, Order> = env
        .storage()
        .instance()
        .get(&DataKey::Orders)
        .unwrap_or(Map::new(env));

    let order = orders.get(order_id).expect("order not found");
    assert!(&order.owner == owner, "not your order");

    let remaining = order.amount - order.filled;

    if remaining > 0 {
        let collateral: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .unwrap();

        if order.is_buy {
            // Refund escrowed USDC proportional to unfilled amount
            let refund = (remaining * order.price_bps as i128) / 10_000;
            if refund > 0 {
                token::Client::new(env, &collateral)
                    .transfer(&env.current_contract_address(), owner, &refund);
            }
        } else {
            // Return YES tokens to seller
            let yes_bal: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::YesBalance(owner.clone()))
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&DataKey::YesBalance(owner.clone()), &(yes_bal + remaining));
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::YesBalance(owner.clone()), 50_000, 100_000);
        }
    }

    orders.remove(order_id);
    env.storage().instance().set(&DataKey::Orders, &orders);
    crate::events::emit_order_cancelled(env, order_id);
}

/// Greedy order matching engine.
///
/// Iterates all open orders looking for buy/sell pairs where buy.price_bps >= sell.price_bps.
/// Fills at the sell (maker) price. Returns escrowed USDC difference to buyer if buy price > sell price.
///
/// Complexity: O(n²) — acceptable for hackathon scale.
/// Production path: maintain sorted order arrays by price-time priority.
pub fn fill_orders(env: &Env, max_fills: u32) {
    let mut orders: Map<u64, Order> = env
        .storage()
        .instance()
        .get(&DataKey::Orders)
        .unwrap_or(Map::new(env));

    let collateral: Address = env
        .storage()
        .instance()
        .get(&DataKey::CollateralToken)
        .unwrap();
    let col_client = token::Client::new(env, &collateral);

    let mut fills = 0u32;
    let keys: soroban_sdk::Vec<u64> = orders.keys();

    'outer: for i in 0..keys.len() {
        let buy_id = keys.get(i).unwrap();
        let buy = match orders.get(buy_id) {
            None => continue,
            Some(o) if !o.is_buy => continue,
            Some(o) if o.filled >= o.amount => continue,
            Some(o) => o,
        };

        for j in 0..keys.len() {
            if i == j {
                continue;
            }
            let sell_id = keys.get(j).unwrap();
            let sell = match orders.get(sell_id) {
                None => continue,
                Some(o) if o.is_buy => continue,
                Some(o) if o.filled >= o.amount => continue,
                Some(o) => o,
            };

            // Price-time matching: fill if buyer's bid >= seller's ask
            if buy.price_bps >= sell.price_bps {
                let fill_amount = (buy.amount - buy.filled).min(sell.amount - sell.filled);
                if fill_amount == 0 {
                    continue;
                }

                // Execute at sell (maker) price
                let execution_price = sell.price_bps;
                let usdc_to_seller = (fill_amount * execution_price as i128) / 10_000;

                // Pay seller the premium (USDC)
                if usdc_to_seller > 0 {
                    col_client.transfer(
                        &env.current_contract_address(),
                        &sell.owner,
                        &usdc_to_seller,
                    );
                }

                // Credit YES tokens to buyer's balance
                let yes_bal: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::YesBalance(buy.owner.clone()))
                    .unwrap_or(0);
                env.storage()
                    .persistent()
                    .set(&DataKey::YesBalance(buy.owner.clone()), &(yes_bal + fill_amount));
                env.storage().persistent().extend_ttl(
                    &DataKey::YesBalance(buy.owner.clone()),
                    50_000,
                    100_000,
                );

                // Refund buyer if they bid higher than execution price
                let buyer_escrowed = (fill_amount * buy.price_bps as i128) / 10_000;
                let refund = buyer_escrowed - usdc_to_seller;
                if refund > 0 {
                    col_client.transfer(
                        &env.current_contract_address(),
                        &buy.owner,
                        &refund,
                    );
                }

                // Update fill counts; remove fully-filled orders
                let mut updated_buy = buy.clone();
                let mut updated_sell = sell.clone();
                updated_buy.filled += fill_amount;
                updated_sell.filled += fill_amount;

                if updated_buy.filled >= updated_buy.amount {
                    orders.remove(buy_id);
                } else {
                    orders.set(buy_id, updated_buy);
                }
                if updated_sell.filled >= updated_sell.amount {
                    orders.remove(sell_id);
                } else {
                    orders.set(sell_id, updated_sell);
                }

                crate::events::emit_order_filled(
                    env,
                    buy_id,
                    sell_id,
                    fill_amount,
                    execution_price,
                );

                fills += 1;
                if fills >= max_fills {
                    break 'outer;
                }
                break; // restart inner scan after a fill
            }
        }
    }

    env.storage().instance().set(&DataKey::Orders, &orders);
}
