/**
 * acr.ts — Reads and manages ACR (Anchor Confidence Ratio) scores from the
 * anchor-stake (Risk Registry) contract.
 *
 * ACR is a composite Operational Risk Score (0 - 10,000 bps) calculated on-chain
 * based on metrics pushed by this off-chain Risk Oracle.
 */

import { nativeToScVal } from '@stellar/stellar-sdk';
import { CONFIG } from './config';
import { queryContract, invokeContract, keypair } from './soroban';

interface AcrEntry {
  anchor: string;
  acrBps: bigint;
  acrFloat: number;
  rating: string;
}

function getRating(acrBps: bigint): string {
  const n = Number(acrBps);
  if (n >= 9500) return 'AAA';
  if (n >= 9000) return 'AA';
  if (n >= 8000) return 'A';
  if (n >= 7000) return 'BBB';
  return 'C';
}

/**
 * Reads all anchor ACR scores from the Risk Registry and logs them.
 */
export async function readAndLogAllAcr(): Promise<AcrEntry[]> {
  try {
    const raw = await queryContract(
      CONFIG.ANCHOR_STAKE_CONTRACT,
      'get_all_acr',
      [],
    ) as Array<[string, bigint]>;

    if (!Array.isArray(raw) || raw.length === 0) {
      console.log('[ACR/RiskOracle] No anchors registered yet');
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
        `[ACR/RiskOracle] ${e.anchor.slice(0, 8)}…: ` +
        `Score: ${(e.acrFloat * 100).toFixed(2)}% (${e.rating}) ` +
        `[${e.acrBps} bps]`,
      );
    }

    return entries;
  } catch (err) {
    console.error('[ACR/RiskOracle] Failed to read ACR scores:', (err as Error).message);
    return [];
  }
}

/**
 * Pushes simulated operational metrics to the on-chain Risk Registry.
 * Used for the Jaipur residency sprint to demonstrate the Risk Oracle architecture.
 */
export async function pushMockMetrics(anchorAddress: string) {
  console.log(`[RiskOracle] Aggregating SEP-24 API data for ${anchorAddress}...`);
  console.log(`[RiskOracle] Success Rate: 99.2%. Latency: 1m. Pushing to Soroban...`);
  
  try {
    await invokeContract(
      CONFIG.ANCHOR_STAKE_CONTRACT,
      'update_anchor_metrics',
      [
        nativeToScVal(keypair.publicKey(), { type: 'address' }), // admin
        nativeToScVal(anchorAddress, { type: 'address' }),       // anchor
        nativeToScVal(9920, { type: 'u32' }),                    // success_rate_bps (99.2%)
        nativeToScVal(60, { type: 'u32' }),                      // avg_latency_seconds (1 min)
        nativeToScVal(0, { type: 'u32' }),                       // failed_withdrawals
        nativeToScVal(9999, { type: 'u32' }),                    // oracle_uptime_bps (99.99%)
        nativeToScVal(0, { type: 'i128' }),                      // historical_payouts
      ]
    );
    console.log(`[RiskOracle] Metrics pushed successfully for ${anchorAddress}`);
  } catch (err) {
    console.error(`[RiskOracle] Failed to push metrics:`, (err as Error).message);
  }
}
