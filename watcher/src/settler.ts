/**
 * settler.ts — triggers settlement and order matching on all open markets.
 *
 * try_settle():
 *   Permissionless — no auth required, anyone can call it.
 *   The contract reads the oracle and runs the breach timer logic itself.
 *   We just need to call it every tick to keep the timer progressing.
 *
 * fill_orders(caller, max_fills):
 *   Requires the caller to sign (caller.require_auth()).
 *   The watcher's keypair is the caller.
 *   NOTE: spec's settler.ts was missing the `caller` arg — fixed here.
 */

import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { invokeContract, keypair } from './soroban';
import { getOraclePrice } from './redstone';
import { CONFIG } from './config';

/**
 * For each market, reads the oracle price for logging context, then calls
 * try_settle(). The contract handles all the settlement logic internally.
 */
export async function runSettlementCheck(
  marketContracts: Map<number, string>,
): Promise<void> {
  for (const [marketId, contractAddr] of marketContracts) {
    const marketCfg = CONFIG.MARKETS.find((m) => m.id === marketId);

    // Log current price for observability (the contract also reads it)
    if (marketCfg) {
      const price = await getOraclePrice(marketCfg.symbol);
      if (price !== null) {
        console.log(
          `[Settler] Market ${marketId} (${marketCfg.symbol}): price=$${price.toFixed(6)}`,
        );
      } else {
        console.log(
          `[Settler] Market ${marketId} (${marketCfg?.symbol ?? '?'}): oracle unavailable`,
        );
      }
    }

    try {
      await invokeContract(contractAddr, 'try_settle', []);
      console.log(`[Settler] try_settle ok — market ${marketId}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (
        msg.includes('market not open') ||
        msg.includes('already settled') ||
        msg.includes('market already') ||
        msg.includes('UnreachableCodeReached') ||
        msg.includes('InvalidAction')
      ) {
        console.log(`[Settler] Market ${marketId} already settled, skipping`);
      } else {
        console.warn(`[Settler] try_settle market ${marketId}: ${msg.split('\n')[0]}`);
      }
    }
  }
}

/**
 * For each market, calls fill_orders(caller, max_fills) to match any
 * pending buy and sell orders.
 *
 * fill_orders requires caller auth — the watcher keypair signs as caller.
 */
export async function runOrderMatching(
  marketContracts: Map<number, string>,
): Promise<void> {
  // Watcher's public key is the caller for fill_orders
  const callerAddress = keypair.publicKey();

  for (const [marketId, contractAddr] of marketContracts) {
    try {
      const args: xdr.ScVal[] = [
        nativeToScVal(callerAddress, { type: 'address' }),
        nativeToScVal(CONFIG.MAX_FILLS_PER_TICK, { type: 'u32' }),
      ];
      await invokeContract(contractAddr, 'fill_orders', args);
      console.log(`[Matcher] fill_orders ok — market ${marketId}`);
    } catch (err) {
      const msg = (err as Error).message;
      // "market not open" is fine — market settled, no more fills needed
      if (!msg.includes('market not open')) {
        console.warn(`[Matcher] fill_orders market ${marketId}: ${msg}`);
      }
    }
  }
}
