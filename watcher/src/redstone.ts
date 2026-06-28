/**
 * redstone.ts — reads price data from the RedStone SEP-40 oracle contract.
 *
 * RedStone uses a push model: an off-chain relay pushes prices on-chain,
 * and the contract stores them. We call lastprice(asset: Symbol).
 *
 * Price format: 14-decimal fixed point.
 *   $1.00 = 100_000_000_000_000 (1e14)
 *   $0.995 = 99_500_000_000_000
 */

import { nativeToScVal } from '@stellar/stellar-sdk';
import { CONFIG } from './config';
import { queryContract } from './soroban';

/** Maximum age of a price before we treat it as stale (seconds). */
const FRESHNESS_SECONDS = 300; // 5 minutes — matches contract-side check

interface PriceData {
  price: bigint;
  timestamp: bigint;
}

/**
 * Reads the latest price for an asset symbol from the RedStone oracle contract.
 *
 * Returns the price as a plain JS number (normalized to USD, e.g. 0.994).
 * Returns null if the oracle has no data, or if the price is stale.
 */
export async function getOraclePrice(assetSymbol: string): Promise<number | null> {
  try {
    // Contract method: lastprice(asset: Symbol) -> Option<PriceData>
    // scValToNative converts Option<PriceData> to { price: bigint, timestamp: bigint } | null
    const result = await queryContract(
      CONFIG.REDSTONE_CONTRACT,
      'lastprice',
      [nativeToScVal(assetSymbol, { type: 'symbol' })],
    ) as PriceData | null;

    if (!result) {
      console.warn(`[RedStone] No price data for ${assetSymbol}`);
      return null;
    }

    const priceUsd = Number(result.price) / 1e14;
    const ageSeconds = Math.floor(Date.now() / 1000) - Number(result.timestamp);

    if (ageSeconds > FRESHNESS_SECONDS) {
      console.warn(
        `[RedStone] Stale price for ${assetSymbol}: ${ageSeconds}s old (limit ${FRESHNESS_SECONDS}s)`,
      );
      return null;
    }

    return priceUsd;
  } catch (err) {
    console.error(`[RedStone] Failed to read ${assetSymbol}:`, (err as Error).message);
    return null;
  }
}
