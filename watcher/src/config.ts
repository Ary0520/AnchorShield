import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const CONFIG = {
  // ── Network ────────────────────────────────────────────────────────────────
  STELLAR_RPC_URL: process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  HORIZON_URL: process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  NETWORK_PASSPHRASE: process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',

  // ── Watcher keypair ─────────────────────────────────────────────────────────
  // Must be funded with XLM to pay transaction fees.
  WATCHER_SECRET_KEY: required('WATCHER_SECRET_KEY'),

  // ── Deployed contract addresses ─────────────────────────────────────────────
  MARKET_FACTORY_CONTRACT: required('MARKET_FACTORY_CONTRACT'),
  ANCHOR_STAKE_CONTRACT: required('ANCHOR_STAKE_CONTRACT'),

  // ── RedStone SEP-40 oracle ───────────────────────────────────────────────────
  // Address of the RedStone price feed contract on Stellar.
  // Fetch from: https://docs.redstone.finance/docs/smart-contract-devs/get-started/stellar
  REDSTONE_CONTRACT: required('REDSTONE_CONTRACT'),

  // ── Polling ─────────────────────────────────────────────────────────────────
  // How many order fills to attempt per market per tick.
  // Must not exceed 50 (contract-enforced limit).
  MAX_FILLS_PER_TICK: 10,

  // ── Market config (must match on-chain market parameters) ───────────────────
  // Used by the watcher for logging context; settlement logic lives in the contract.
  MARKETS: [
    { id: 0, symbol: 'USDC',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 1, symbol: 'EURC',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 2, symbol: 'MGUSD', threshold_pct: 0.995, breach_hours: 1 },
    { id: 3, symbol: 'PYUSD', threshold_pct: 0.995, breach_hours: 1 },
    { id: 4, symbol: 'BENJI', threshold_pct: 0.990, breach_hours: 4 },
  ] as const,

  // ── Anchor accounts to monitor via Horizon ───────────────────────────────────
  ANCHORS: [
    {
      id: 'moneygram',
      domain: 'moneygram.com',
      sep24_url: 'https://extstellar.moneygram.com/stellartoml/transferserver',
      stuck_tx_threshold_hours: 24,
    },
  ] as const,
} as const;

export type MarketEntry = (typeof CONFIG.MARKETS)[number];
export type AnchorEntry = (typeof CONFIG.ANCHORS)[number];
