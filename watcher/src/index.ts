/**
 * index.ts — AnchorShield watcher entry point.
 *
 * On every tick (every 60 seconds):
 *   1. Fetch all market contracts from the factory
 *   2. Call try_settle() on each open market
 *   3. Call fill_orders() on each open market
 *   4. Read and log ACR scores (every 10 ticks to reduce RPC calls)
 *   5. Check anchor health via Horizon (every 10 ticks)
 */

import cron from 'node-cron';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { CONFIG } from './config';
import { queryContract } from './soroban';
import { runSettlementCheck, runOrderMatching } from './settler';
import { readAndLogAllAcr } from './acr';
import { checkAllAnchors } from './horizon';

let tickCount = 0;

/**
 * Fetches all deployed market contract addresses from the factory.
 * Returns a Map<market_id, contract_address>.
 */
async function getMarketContracts(): Promise<Map<number, string>> {
  const markets = new Map<number, string>();

  // list_markets() -> Vec<u32>
  const ids = await queryContract(
    CONFIG.MARKET_FACTORY_CONTRACT,
    'list_markets',
    [],
  ) as number[];

  if (!Array.isArray(ids) || ids.length === 0) {
    return markets;
  }

  // get_market(market_id: u32) -> MarketConfig
  // We only need the market_contract field from each config
  await Promise.all(
    ids.map(async (id) => {
      const cfg = await queryContract(
        CONFIG.MARKET_FACTORY_CONTRACT,
        'get_market',
        [nativeToScVal(id, { type: 'u32' })],
      ) as { market_contract: string };
      markets.set(id, cfg.market_contract);
    }),
  );

  return markets;
}

async function tick(): Promise<void> {
  tickCount++;
  const currentTick = tickCount; // Capture it locally to avoid race conditions
  console.log(`\n[Watcher] ── Tick #${currentTick} at ${new Date().toISOString()} ──`);

  try {
    // 1. Run the Oracle first so it's instantly visible on demo
    if (currentTick === 1 || currentTick % 3 === 0) {
      await readAndLogAllAcr();
      await checkAllAnchors();
    }

    // 2. Then run the slow on-chain stuff
    const marketContracts = await getMarketContracts();

    if (marketContracts.size === 0) {
      console.log('[Watcher] No markets deployed yet — nothing to do');
    } else {
      console.log(`[Watcher] Found ${marketContracts.size} market(s)`);
      await runSettlementCheck(marketContracts);
      await runOrderMatching(marketContracts);
    }
  } catch (err) {
    console.error('[Watcher] Tick error:', (err as Error).message);
  }
}

// ── Start ──────────────────────────────────────────────────────────────────

console.log('[Watcher] AnchorShield watcher starting...');
console.log(`[Watcher] RPC: ${CONFIG.STELLAR_RPC_URL}`);
console.log(`[Watcher] Factory: ${CONFIG.MARKET_FACTORY_CONTRACT}`);
console.log('[Watcher] Polling every 60 seconds. Press Ctrl+C to stop.\n');

// Run once immediately on startup
tick();

// Then every minute
cron.schedule('*/1 * * * *', () => {
  tick().catch((err) => console.error('[Watcher] Unhandled tick error:', err));
});
