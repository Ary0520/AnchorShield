import axios from 'axios';
import { CONFIG } from './config';
import { pingAnchorSep24, getAnchorStats } from './sep24';
import { pushLiveMetrics } from './acr';

export interface AnchorHealth {
  anchorId: string;
  stuckTxCount: number;
  isHealthy: boolean;
  checkedAt: string;
}

export async function checkAnchorHealth(
  anchorId: string,
  distributionAccount: string,
  stuckThresholdHours: number,
): Promise<AnchorHealth & { payoutVolume: number }> {
  const url = `${CONFIG.HORIZON_URL}/accounts/${distributionAccount}/payments?order=desc&limit=200`;

  try {
    const response = await axios.get<{
      _embedded: { records: any[] };
    }>(url, { timeout: 10_000 });

    const payments = response.data._embedded.records;
    let stuckCount = 0;
    let payoutVolume = 0;

    for (const payment of payments) {
      if (payment.type !== 'payment') continue;
      if (payment.to === distributionAccount) {
         payoutVolume += parseFloat(payment.amount);
      }
    }
    
    const stats = getAnchorStats(anchorId);
    stuckCount = stats.totalPings - stats.successfulPings;

    const isHealthy = stuckCount < 5;
    if (!isHealthy) {
      console.warn(`[Horizon] Anchor ${anchorId} has ${stuckCount} failed pings (threshold: 5)`);
    }

    return {
      anchorId,
      stuckTxCount: stuckCount,
      isHealthy,
      checkedAt: new Date().toISOString(),
      payoutVolume
    };
  } catch (err) {
    console.error(`[Horizon] Health check failed for ${anchorId}:`, (err as Error).message);
    const stats = getAnchorStats(anchorId);
    return {
      anchorId,
      stuckTxCount: stats.totalPings - stats.successfulPings,
      isHealthy: false,
      checkedAt: new Date().toISOString(),
      payoutVolume: 0
    };
  }
}

export async function checkAllAnchors(): Promise<void> {
  for (const anchor of CONFIG.ANCHORS) {
    const domain = anchor.domain;
    
    console.log(`[Horizon] Starting live SEP-24 ping for ${domain}...`);
    const pingResult = await pingAnchorSep24(domain);
    
    const healthResult = await checkAnchorHealth(domain, anchor.publicKey, anchor.stuck_tx_threshold_hours);
    
    // NO MOCKS EVER AGAIN. We use 100% REAL Mainnet Volume!
    const finalVolume = healthResult.payoutVolume;
    
    const stats = getAnchorStats(domain);
    
    // Bootstrap stats if watcher just started so it doesn't default to 0% uptime on boot
    if (stats.totalPings === 0) {
      stats.totalPings = 1;
      stats.successfulPings = pingResult.isUp ? 1 : 0;
      stats.totalLatencyMs = pingResult.latencyMs || 500;
    }
    
    let successRateBps = 0;
    if (stats.totalPings > 0) {
      successRateBps = Math.floor((stats.successfulPings / stats.totalPings) * 10000);
    }
    
    let avgLatencyMs = pingResult.latencyMs;
    if (stats.successfulPings > 0) {
      avgLatencyMs = Math.floor(stats.totalLatencyMs / stats.totalPings);
    }

    console.log(
      `[Horizon] Anchor ${anchor.id} (${domain}): ` +
      `${pingResult.isUp ? 'UP' : 'DOWN'} ` +
      `(${avgLatencyMs}ms avg latency) | ` +
      `Success: ${(successRateBps / 100).toFixed(2)}% | ` +
      `Failed Pings: ${healthResult.stuckTxCount} | ` +
      `Payout Vol: ${finalVolume.toFixed(2)}`
    );

    await pushLiveMetrics(
      anchor.publicKey, 
      avgLatencyMs, 
      successRateBps, 
      healthResult.stuckTxCount, 
      finalVolume
    );
  }
}
