/// AnchorShield — Contract Addresses
///
/// All addresses must be fetched from official sources before use.
/// See details.txt §9 for instructions.
///
/// TESTNET addresses
// ── Tokens ──────────────────────────────────────────────────────────────────
// Verify at https://stellar.expert/explorer/testnet
pub const TESTNET_USDC_SAC: &str = "CCW67TSZV3SSS2HXMBQ5JFGCKJNFESNU4W4III5JEHE74XX53P6BYOS";
pub const TESTNET_EURC_SAC: &str = ""; // TODO: fetch from stellar.expert testnet
pub const TESTNET_MGUSD_SAC: &str = ""; // TODO: fetch after MGUSD testnet launch
pub const TESTNET_PYUSD_SAC: &str = ""; // TODO: fetch from stellar.expert testnet

// ── Oracles ─────────────────────────────────────────────────────────────────
// Fetch from https://docs.redstone.finance/docs/smart-contract-devs/get-started/stellar
pub const TESTNET_REDSTONE_ORACLE: &str = ""; // TODO

// ── DeFindex vaults (yield) ──────────────────────────────────────────────────
// Fetch from https://defindex.io
pub const TESTNET_DEFINDEX_USDC_VAULT: &str = ""; // TODO

// ── Deployed AnchorShield contracts (populated after `scripts/deploy-testnet.sh`) ──
pub const TESTNET_ANCHOR_STAKE: &str = ""; // TODO
pub const TESTNET_MARKET_FACTORY: &str = ""; // TODO

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// MAINNET addresses
// ── Tokens ──────────────────────────────────────────────────────────────────
// Issuer: USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
// Issuer: EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP
// Fetch SAC contract IDs from https://stellar.expert/explorer/public
pub const MAINNET_USDC_SAC: &str = ""; // TODO
pub const MAINNET_EURC_SAC: &str = ""; // TODO
pub const MAINNET_MGUSD_SAC: &str = ""; // TODO: Bridge/MoneyGram (launched Jun 2, 2026)
pub const MAINNET_PYUSD_SAC: &str = ""; // TODO: PayPal (launched Sep 2025)

// ── Oracles ─────────────────────────────────────────────────────────────────
pub const MAINNET_REDSTONE_ORACLE: &str = ""; // TODO

// ── DeFindex vaults (yield) ──────────────────────────────────────────────────
// Blend USDC strategy vault — verify at https://defindex.io before use
pub const MAINNET_DEFINDEX_USDC_VAULT: &str =
    "CAEJL2XKGLSWCPKSVVRYAWLQKE4DS24YCZX53CLUMWGOVEOERSAZH5UM";

// ── Deployed AnchorShield contracts (populated after `scripts/deploy-mainnet.sh`) ──
pub const MAINNET_ANCHOR_STAKE: &str = ""; // TODO
pub const MAINNET_MARKET_FACTORY: &str = ""; // TODO
