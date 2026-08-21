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

  // ── Oracle ───────────────────────────────────────────────────────────────────
  // Reflector Network oracle (SEP-40 compatible).
  // RedStone's Stellar docs returned 404 as of June 2026.
  // Reflector is listed on https://developers.stellar.org/docs/data/oracles/oracle-providers
  // Testnet (External CEXs/DEXs): CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63
  // Mainnet (External CEXs/DEXs): CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN
  ORACLE_CONTRACT: required('ORACLE_CONTRACT'),

  // ── Polling ─────────────────────────────────────────────────────────────────
  // How many order fills to attempt per market per tick.
  // Must not exceed 50 (contract-enforced limit).
  MAX_FILLS_PER_TICK: 10,

  // ── Market config (must match on-chain market parameters) ───────────────────
  // Used by the watcher for logging context; settlement logic lives in the contract.
  MARKETS: [
    { id: 0, symbol: 'USDC',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 1, symbol: 'EURC',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 2, symbol: 'DAI',   threshold_pct: 0.995, breach_hours: 1 },
    { id: 3, symbol: 'USDT',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 4, symbol: 'USDC',  threshold_pct: 0.995, breach_hours: 1 }, // short-expiry test
  ] as const,

  // ── Anchor accounts to monitor via Horizon ───────────────────────────────────
  ANCHORS: [
    {
      id: 'moneygram',
      domain: 'extstellar.moneygram.com',
      sep24_url: 'https://extstellar.moneygram.com/stellartoml/transferserver',
      stuck_tx_threshold_hours: 24,
    },
  ] as const,
} as const;

export type MarketEntry = (typeof CONFIG.MARKETS)[number];
export type AnchorEntry = (typeof CONFIG.ANCHORS)[number];
