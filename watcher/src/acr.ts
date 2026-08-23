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
        `[ACR/RiskOracle] ${e.anchor.slice(0, 8)}...: ` +
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

export async function pushLiveMetrics(
  anchorAddress: string,
  latencyMs: number,
  successRateBps: number,
  refundCount: number,
  hotWalletHealthBps: number,
  payoutVolume: number
) {
  // Convert ms to seconds (minimum 1 sec)
  const avg_latency_seconds = Math.max(1, Math.ceil(latencyMs / 1000));
  
  // payoutVolume is in fiat (e.g. 50000.50). Convert to stroops (7 decimals)
  const payoutStroops = BigInt(Math.floor(payoutVolume * 10_000_000));
  
  console.log(`[RiskOracle] Aggregated Data for ${anchorAddress} -> Latency: ${avg_latency_seconds}s, Success: ${successRateBps}bps, Refunds: ${refundCount}, HW Health: ${hotWalletHealthBps}bps, Vol: ${payoutVolume}`);
  
  try {
    // The smart contract expects:
    // success_rate_bps (u32)
    // avg_latency_seconds (u32)
    // failed_withdrawals (u32) -> We pass refundCount here
    // oracle_uptime_bps (u32) -> We pass hotWalletHealthBps here
    // historical_payouts (i128)
    await invokeContract(
      CONFIG.ANCHOR_STAKE_CONTRACT,
      'update_anchor_metrics',
      [
        nativeToScVal(keypair.publicKey(), { type: 'address' }), // admin
        nativeToScVal(anchorAddress, { type: 'address' }),       // anchor
        nativeToScVal(successRateBps, { type: 'u32' }),        
        nativeToScVal(avg_latency_seconds, { type: 'u32' }),     
        nativeToScVal(refundCount, { type: 'u32' }),       
        nativeToScVal(hotWalletHealthBps, { type: 'u32' }),       
        nativeToScVal(payoutStroops, { type: 'i128' }),          
      ]
    );
    console.log(`[RiskOracle] Live metrics pushed successfully for ${anchorAddress}`);
  } catch (err) {
    console.error(`[RiskOracle] Failed to push live metrics:`, (err as Error).message);
  }
}
