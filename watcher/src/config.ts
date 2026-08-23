import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const CONFIG = {
  STELLAR_RPC_URL: process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  // USE MAINNET HORIZON TO GET REAL VOLUMES
  HORIZON_URL: 'https://horizon.stellar.org',
  NETWORK_PASSPHRASE: process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',

  WATCHER_SECRET_KEY: required('WATCHER_SECRET_KEY'),
  MARKET_FACTORY_CONTRACT: required('MARKET_FACTORY_CONTRACT'),
  ANCHOR_STAKE_CONTRACT: required('ANCHOR_STAKE_CONTRACT'),
  ORACLE_CONTRACT: required('ORACLE_CONTRACT'),

  MAX_FILLS_PER_TICK: 10,

  MARKETS: [
    { id: 0, symbol: 'USDC',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 1, symbol: 'EURC',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 2, symbol: 'DAI',   threshold_pct: 0.995, breach_hours: 1 },
    { id: 3, symbol: 'USDT',  threshold_pct: 0.995, breach_hours: 1 },
    { id: 4, symbol: 'USDC',  threshold_pct: 0.995, breach_hours: 1 }, 
  ] as const,

  ANCHORS: [
    {
      id: 'circle',
      domain: 'ultrastellar.com', // Massive real production server
      publicKey: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // Mainnet USDC Issuer
      stuck_tx_threshold_hours: 24,
    },
    {
      id: 'moneygram',
      domain: 'stellar.moneygram.com', // Real MoneyGram SEP-24
      publicKey: 'GAVBS6SXMRD7C3IRN5K2SY5C2CAUFHBVOGWTQXADSBUHAFDDUKVTQWWY', // Mainnet active account
      stuck_tx_threshold_hours: 24,
    },
  ] as const,
} as const;

export type MarketEntry = (typeof CONFIG.MARKETS)[number];
export type AnchorEntry = (typeof CONFIG.ANCHORS)[number];
