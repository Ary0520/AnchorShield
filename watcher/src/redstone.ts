/**
 * oracle.ts (named redstone.ts for historical reasons — kept to avoid import churn)
 *
 * Reads price data from the Reflector Network SEP-40 oracle contract.
 *
 * WHY REFLECTOR (not RedStone):
 *   RedStone's Stellar integration uses a PULL model — the consumer must attach
 *   signed price data to each transaction via their stellar-connector package.
 *   Our settlement contract uses SEP-40's PUSH model: it calls lastprice() to
 *   read a price already stored on-chain. RedStone's architecture is incompatible.
 *
 *   Reflector uses a push model, is SEP-40 compatible, updates every 5 minutes,
 *   and is officially listed on Stellar's oracle provider docs.
 *
 * Reflector "External CEXs & DEXs" oracle addresses:
 *   Testnet:  CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63
 *   Mainnet:  CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN
 *
 * Sources:
 *   https://developers.stellar.org/docs/data/oracles/oracle-providers
 *   https://reflector.network/docs
 *
 * Reflector price format: 14-decimal fixed point, base USD.
 *   $1.00  = 100_000_000_000_000 (1e14)  — matches our contract's ORACLE_DECIMALS
 *   $0.995 =  99_500_000_000_000
 *
 * Supported symbols (from live feed): USDC, EURC, XLM, BTC, ETH, PYUSD, BENJI, ...
 * Symbol names are passed as Soroban Symbol type — e.g. "USDC", "EURC"
 */

import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { CONFIG } from './config';
import { queryContract } from './soroban';

/**
 * Maximum price age before treating it as stale.
 * Must match the ORACLE_FRESHNESS_SECONDS constant in settlement.rs (300s).
 * Reflector updates every 5 minutes, so a 5-minute window is the minimum safe value.
 */
const FRESHNESS_SECONDS = 300;

interface PriceData {
  price: bigint;
  timestamp: bigint;
}

/**
 * Reads the latest price for an asset symbol from the Reflector oracle contract.
 *
 * Returns the price in USD as a plain JS number (e.g. 0.9948).
 * Returns null if:
 *   - The oracle has no data for this symbol
 *   - The price is older than FRESHNESS_SECONDS (stale)
 *   - Any RPC error occurs
 *
 * The symbol must match Reflector's registered symbol name exactly.
 * From live feed: USDC, EURC, XLM, BTC, ETH, XRP, PYUSD work as plain strings.
 */
export async function getOraclePrice(assetSymbol: string): Promise<number | null> {
  try {
    // lastprice(asset: Asset) -> Option<PriceData>
    // Asset enum:
    //  - 0: Stellar(Address)
    //  - 1: Other(Symbol)
    // Encode as a vector: first element is u32 variant index, second is the value
    const symbolScVal = nativeToScVal(assetSymbol, { type: 'symbol' });
    const variantIndexScVal = nativeToScVal(1, { type: 'u32' }); // Other is index 1
    const assetScVal = xdr.ScVal.scvVec([variantIndexScVal, symbolScVal]);

    const result = await queryContract(
      CONFIG.ORACLE_CONTRACT,
      'lastprice',
      [assetScVal],
    ) as PriceData | null;

    if (!result) {
      console.warn(`[Oracle] No data for symbol "${assetSymbol}" — check symbol name`);
      return null;
    }

    // Reflector uses 14-decimal precision — divide by 1e14 to get USD value
    const priceUsd = Number(result.price) / 1e14;
    const ageSeconds = Math.floor(Date.now() / 1000) - Number(result.timestamp);

    if (ageSeconds > FRESHNESS_SECONDS) {
      console.warn(
        `[Oracle] Stale price for ${assetSymbol}: ${ageSeconds}s old (limit ${FRESHNESS_SECONDS}s). ` +
        `Reflector updates every 5 min — check if oracle contract is active.`,
      );
      return null;
    }

    return priceUsd;
  } catch (err) {
    console.error(`[Oracle] Failed to read "${assetSymbol}":`, (err as Error).message);
    return null;
  }
}
