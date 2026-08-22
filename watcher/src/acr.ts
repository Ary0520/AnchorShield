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
export async function pushLiveMetrics(
  anchorAddress: string,
  latencyMs: number,
  isUp: boolean,
  failedWithdrawals: number,
  payoutVolume: number
) {
  // Convert ms to seconds (minimum 1 sec)
  const avg_latency_seconds = Math.max(1, Math.ceil(latencyMs / 1000));
  
  // Real success rate. If it's down, success drops to 0 for this tick.
  const success_rate_bps = isUp ? 9950 : 0; // 99.5% success if up
  const oracle_uptime_bps = isUp ? 9999 : 5000; // Big penalty if down
  
  // payoutVolume is in fiat (e.g. 50000.50). Convert to stroops (7 decimals)
  // Smart contract expects i128 stroops.
  const payoutStroops = BigInt(Math.floor(payoutVolume * 10_000_000));
  
  console.log(`[RiskOracle] Aggregated Data for ${anchorAddress} -> Latency: ${avg_latency_seconds}s, Up: ${isUp}, Fails: ${failedWithdrawals}, Vol: ${payoutVolume}`);
  
  try {
    await invokeContract(
      CONFIG.ANCHOR_STAKE_CONTRACT,
      'update_anchor_metrics',
      [
        nativeToScVal(keypair.publicKey(), { type: 'address' }), // admin
        nativeToScVal(anchorAddress, { type: 'address' }),       // anchor
        nativeToScVal(success_rate_bps, { type: 'u32' }),        
        nativeToScVal(avg_latency_seconds, { type: 'u32' }),     
        nativeToScVal(failedWithdrawals, { type: 'u32' }),       // real failed_withdrawals
        nativeToScVal(oracle_uptime_bps, { type: 'u32' }),       
        nativeToScVal(payoutStroops, { type: 'i128' }),          // real historical_payouts
      ]
    );
    console.log(`[RiskOracle] Live metrics pushed successfully for ${anchorAddress}`);
  } catch (err) {
    console.error(`[RiskOracle] Failed to push live metrics:`, (err as Error).message);
  }
}
