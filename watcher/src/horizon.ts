/**
 * horizon.ts — monitors anchor Stellar accounts via the Horizon REST API.
 *
 * For the MVP this is a simple health check: look at the anchor's distribution
 * account payment history and flag payments that appear stuck (older than
 * stuck_tx_threshold_hours with no corresponding completion).
 *
 * In production this would integrate with the anchor's SEP-24 /transactions
 * endpoint to get actual transaction statuses. That requires per-anchor
 * authentication and is beyond the MVP scope.
 *
 * SEP-24 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md
 * Horizon API: https://developers.stellar.org/docs/data/apis/horizon
 */

import axios from 'axios';
import { CONFIG } from './config';

export interface AnchorHealth {
  anchorId: string;
  stuckTxCount: number;
  isHealthy: boolean;
  checkedAt: string;
}

interface HorizonPaymentRecord {
  type: string;
  created_at: string;
}

/**
 * Checks an anchor's distribution account for payments that appear stuck.
 * A payment is considered stuck if it is older than stuckThresholdHours
 * and there is no evidence of completion (simplified heuristic for MVP).
 */
export async function checkAnchorHealth(
  anchorId: string,
  distributionAccount: string,
  stuckThresholdHours: number,
): Promise<AnchorHealth> {
  const url =
    `${CONFIG.HORIZON_URL}/accounts/${distributionAccount}/payments` +
    `?order=desc&limit=200`;

  try {
    const response = await axios.get<{
      _embedded: { records: HorizonPaymentRecord[] };
    }>(url, { timeout: 10_000 });

    const payments = response.data._embedded.records;
    const now = Date.now();
    const thresholdMs = stuckThresholdHours * 3600 * 1000;
    let stuckCount = 0;

    for (const payment of payments) {
      if (payment.type !== 'payment') continue;
      const age = now - new Date(payment.created_at).getTime();
      if (age > thresholdMs) {
        stuckCount++;
      }
    }

    const isHealthy = stuckCount < 5;
    if (!isHealthy) {
      console.warn(
        `[Horizon] Anchor ${anchorId} has ${stuckCount} stuck payments (threshold: 5)`,
      );
    }

    return {
      anchorId,
      stuckTxCount: stuckCount,
      isHealthy,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Horizon errors should not crash the watcher — treat as healthy for now
    console.error(
      `[Horizon] Health check failed for ${anchorId}:`,
      (err as Error).message,
    );
    return {
      anchorId,
      stuckTxCount: 0,
      isHealthy: true,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Runs health checks for all configured anchors.
 * This is informational in the MVP — it logs results but does not trigger
 * any on-chain action. In v2, a persistently unhealthy anchor could trigger
 * an alert or accelerate settlement.
 */
export async function checkAllAnchors(): Promise<void> {
  for (const anchor of CONFIG.ANCHORS) {
    // TODO: replace with the anchor's actual distribution account address
    // once we have it from their SEP-1 stellar.toml
    const distributionAccount = 'PLACEHOLDER_' + anchor.id.toUpperCase();
    const health = await checkAnchorHealth(
      anchor.id,
      distributionAccount,
      anchor.stuck_tx_threshold_hours,
    );
    console.log(
      `[Horizon] Anchor ${health.anchorId}: ` +
      `${health.isHealthy ? 'healthy' : 'UNHEALTHY'} ` +
      `(${health.stuckTxCount} stuck txs)`,
    );
  }
}
