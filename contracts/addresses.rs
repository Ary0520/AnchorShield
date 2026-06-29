/// AnchorShield — Contract Addresses
///
/// Sources:
///   Oracle addresses: https://developers.stellar.org/docs/data/oracles/oracle-providers
///   USDC/EURC SAC:    https://stellar.expert/explorer/public
///   DeFindex vault:   https://defindex.io
///
/// NOTE: RedStone's Stellar docs page (404 as of June 2026).
/// We use Reflector Network as the oracle provider — it is SEP-40 compatible
/// (same interface), actively maintained, and already integrated with DeFindex.
/// Reflector provides USDC, EURC, PYUSD, BTC, XLM and more.

// ── TESTNET ───────────────────────────────────────────────────────────────────

/// Testnet USDC SAC — issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
/// Verified June 2026 via: stellar contract id asset --asset USDC:GBBD47...
pub const TESTNET_USDC_SAC: &str = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

/// Reflector testnet oracle — External CEXs & DEXs feeds (USDC, EURC, PYUSD etc.)
/// Source: https://developers.stellar.org/docs/data/oracles/oracle-providers
pub const TESTNET_REFLECTOR_ORACLE: &str = "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63";

/// Reflector testnet oracle — Stellar DEX feeds (alternative)
pub const TESTNET_REFLECTOR_DEX_ORACLE: &str = "CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP";

/// DeFindex testnet vault — fetch from https://defindex.io before use
pub const TESTNET_DEFINDEX_USDC_VAULT: &str = ""; // TODO: fill before deployment

// ── MAINNET ───────────────────────────────────────────────────────────────────

/// Mainnet USDC SAC (Circle)
/// Issuer: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
/// Fetch SAC contract ID at: https://stellar.expert/explorer/public
pub const MAINNET_USDC_SAC: &str = ""; // TODO: fetch from stellar.expert

/// Mainnet EURC SAC (Circle)
/// Issuer: GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP
pub const MAINNET_EURC_SAC: &str = ""; // TODO: fetch from stellar.expert

/// Mainnet MGUSD SAC (MoneyGram Bridge, launched June 2, 2026)
pub const MAINNET_MGUSD_SAC: &str = ""; // TODO: fetch from stellar.expert

/// Mainnet PYUSD SAC (PayPal, launched Sep 2025)
pub const MAINNET_PYUSD_SAC: &str = ""; // TODO: fetch from stellar.expert

/// Reflector mainnet oracle — External CEXs & DEXs feeds
/// Source: https://developers.stellar.org/docs/data/oracles/oracle-providers
pub const MAINNET_REFLECTOR_ORACLE: &str = "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";

/// Reflector mainnet oracle — Stellar DEX feeds
pub const MAINNET_REFLECTOR_DEX_ORACLE: &str = "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";

/// DeFindex Blend USDC strategy vault on mainnet
/// Source: https://defindex.io
pub const MAINNET_DEFINDEX_USDC_VAULT: &str = "CAEJL2XKGLSWCPKSVVRYAWLQKE4DS24YCZX53CLUMWGOVEOERSAZH5UM";

// ── Deployed AnchorShield contracts (filled after deployment) ─────────────────

pub const TESTNET_ANCHOR_STAKE: &str = "";   // filled by deploy-testnet.sh
pub const TESTNET_MARKET_FACTORY: &str = ""; // filled by deploy-testnet.sh

pub const MAINNET_ANCHOR_STAKE: &str = "";   // filled by deploy-mainnet.sh
pub const MAINNET_MARKET_FACTORY: &str = ""; // filled by deploy-mainnet.sh
