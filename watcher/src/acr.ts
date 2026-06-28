/**
 * acr.ts — reads and logs ACR (Anchor Confidence Ratio) scores from the
 * anchor-stake contract.
 *
 * ACR is computed on-chain by the anchor-stake contract whenever stakes or
 * cover outstanding changes. The watcher does NOT write ACR — it only reads
 * it for observability and logging.
 *
 * ACR format: basis points where 10_000 = 1.00 (100%).
 *   >20_000 (2.0x) = AAA
 *   10_000-20_000 (1.0–2.0x) = AA
 *   5_000-10_000 (0.5–1.0x) = A
 *   <5_000 = BBB or lower
 */

import { nativeToScVal } from '@stellar/stellar-sdk';
import { CONFIG } from './config';
import { queryContract } from './soroban';

interface AcrEntry {
  anchor: string;
  acrBps: bigint;
  acrFloat: number;
  rating: string;
}

function getRating(acrBps: bigint): string {
  const n = Number(acrBps);
  if (n >= 20_000) return 'AAA';
  if (n >= 10_000) return 'AA';
  if (n >= 5_000)  return 'A';
  if (n >= 1_000)  return 'BBB';
  return 'C';
}

/**
 * Reads all anchor ACR scores from the anchor-stake contract and logs them.
 * Returns the array for any caller that wants to act on the data.
 */
export async function readAndLogAllAcr(): Promise<AcrEntry[]> {
  try {
    // get_all_acr() -> Vec<(Address, i128)>
    // scValToNative converts this to an array of [addressString, bigint] tuples
    const raw = await queryContract(
      CONFIG.ANCHOR_STAKE_CONTRACT,
      'get_all_acr',
      [],
    ) as Array<[string, bigint]>;

    if (!Array.isArray(raw) || raw.length === 0) {
      console.log('[ACR] No anchors registered yet');
      return [];
    }

    const entries: AcrEntry[] = raw.map(([anchor, acrBps]) => ({
      anchor,
      acrBps,
      acrFloat: Number(acrBps) / 10_000,
      rating: getRating(acrBps),
    }));

    for (const e of entries) {
      console.log(
        `[ACR] ${e.anchor.slice(0, 8)}…: ` +
        `${e.acrFloat.toFixed(2)}x (${e.rating}) ` +
        `[${e.acrBps} bps]`,
      );
    }

    return entries;
  } catch (err) {
    console.error('[ACR] Failed to read ACR scores:', (err as Error).message);
    return [];
  }
}

/**
 * Reads ACR for a single anchor by address.
 */
export async function readAcr(anchorAddress: string): Promise<number | null> {
  try {
    const raw = await queryContract(
      CONFIG.ANCHOR_STAKE_CONTRACT,
      'get_acr',
      [nativeToScVal(anchorAddress, { type: 'address' })],
    ) as bigint;

    return Number(raw) / 10_000;
  } catch (err) {
    console.error(`[ACR] Failed to read ACR for ${anchorAddress}:`, (err as Error).message);
    return null;
  }
}
