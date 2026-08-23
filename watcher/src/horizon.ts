import axios from 'axios';
import { CONFIG } from './config';
import { pingAnchorSep24, getAnchorStats } from './sep24';
import { pushLiveMetrics } from './acr';

export interface AnchorHealth {
  anchorId: string;
  refundCount: number;
  hotWalletHealthBps: number;
  checkedAt: string;
  payoutVolume: number;
}

export async function checkAnchorHealth(
  anchorId: string,
  distributionAccount: string,
): Promise<AnchorHealth> {
  const paymentsUrl = `${CONFIG.HORIZON_URL}/accounts/${distributionAccount}/payments?order=desc&limit=200`;
  const accountUrl = `${CONFIG.HORIZON_URL}/accounts/${distributionAccount}`;

  try {
    // 1. Fetch Hot Wallet Balance
    const accResponse = await axios.get(accountUrl, { timeout: 10_000 });
    const balances = accResponse.data.balances || [];
    const nativeBalanceObj = balances.find((b: any) => b.asset_type === 'native');
    const xlmBalance = nativeBalanceObj ? parseFloat(nativeBalanceObj.balance) : 0;
    
    // Scale: 5000 XLM = 100% health (10000 bps). Less XLM linearly reduces health.
    let hotWalletHealthBps = Math.floor((xlmBalance / 5000) * 10000);
    if (hotWalletHealthBps > 10000) hotWalletHealthBps = 10000;
    if (hotWalletHealthBps < 0) hotWalletHealthBps = 0;

    // 2. Fetch Payments for Volume & Refunds
    const payResponse = await axios.get<{
      _embedded: { records: any[] };
    }>(paymentsUrl, { timeout: 10_000 });

    const payments = payResponse.data._embedded.records;
    let refundCount = 0;
    let payoutVolume = 0;

    for (const payment of payments) {
      if (payment.type !== 'payment') continue;
      
      if (payment.to === distributionAccount) {
         // Incoming deposit to anchor
         payoutVolume += parseFloat(payment.amount);
      } else if (payment.from === distributionAccount) {
         // Outgoing payment from anchor (Refund / Failed Off-Ramp)
         refundCount++;
      }
    }

    return {
      anchorId,
      refundCount,
      hotWalletHealthBps,
      checkedAt: new Date().toISOString(),
      payoutVolume
    };
  } catch (err) {
    console.error(`[Horizon] Health check failed for ${anchorId}:`, (err as Error).message);
    return {
      anchorId,
      refundCount: 0,
      hotWalletHealthBps: 10000,
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
    
    const healthResult = await checkAnchorHealth(domain, anchor.publicKey);
    const finalVolume = healthResult.payoutVolume;
    
    const stats = getAnchorStats(domain);
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
      `Refunds: ${healthResult.refundCount} | ` +
      `HW Health: ${(healthResult.hotWalletHealthBps / 100).toFixed(2)}% | ` +
      `Payout Vol: ${finalVolume.toFixed(2)}`
    );

    await pushLiveMetrics(
      anchor.publicKey, 
      avgLatencyMs, 
      successRateBps, 
      healthResult.refundCount, 
      healthResult.hotWalletHealthBps,
      finalVolume
    );
  }
}
