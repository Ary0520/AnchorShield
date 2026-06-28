#!/usr/bin/env bash
# deploy-mainnet.sh — AnchorShield mainnet deployment
#
# !! MAINNET — REAL FUNDS !!
# Run only after:
#   1. Full testnet deployment verified
#   2. All addresses in contracts/addresses.rs filled in
#   3. Audit / review complete
#
# Prerequisites:
#   - stellar-cli installed
#   - Contracts built: cd contracts && stellar contract build
#   - Mainnet identity funded with XLM (minimum ~10 XLM for deploy fees)
#   - All required env vars set (see below)
#
# Required env vars:
#   MAINNET_DEPLOYER_SECRET  — secret key of the deployer account
#   MAINNET_REDSTONE_ORACLE  — RedStone SEP-40 contract address on mainnet
#
# Usage:
#   MAINNET_DEPLOYER_SECRET=S... \
#   MAINNET_REDSTONE_ORACLE=C... \
#   ./scripts/deploy-mainnet.sh

set -euo pipefail

NETWORK="mainnet"
CONTRACTS_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
SCRIPTS_DIR="$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
info()    { echo -e "${GREEN}[deploy-mainnet]${NC} $*"; }
warning() { echo -e "${YELLOW}[deploy-mainnet]${NC} $*"; }
error()   { echo -e "${RED}[deploy-mainnet]${NC} $*"; exit 1; }

# ── Safety check ─────────────────────────────────────────────────────────────
echo ""
warning "══════════════════════════════════════════════════"
warning "  MAINNET DEPLOYMENT — REAL FUNDS WILL BE USED"
warning "══════════════════════════════════════════════════"
echo ""
read -rp "Type 'deploy mainnet' to confirm: " CONFIRM
[[ "$CONFIRM" == "deploy mainnet" ]] || error "Aborted"

# ── Verify required env vars ─────────────────────────────────────────────────
[[ -n "${MAINNET_DEPLOYER_SECRET:-}" ]] || error "MAINNET_DEPLOYER_SECRET not set"
[[ -n "${MAINNET_REDSTONE_ORACLE:-}" ]] || error "MAINNET_REDSTONE_ORACLE not set"

# ── Toolchain check ───────────────────────────────────────────────────────────
stellar --version || error "stellar-cli not found"

# ── Build ─────────────────────────────────────────────────────────────────────
info "Building contracts..."
cd "$CONTRACTS_DIR"
stellar contract build
cd - > /dev/null

for wasm in anchor_stake insurance_market market_factory; do
  [[ -f "$WASM_DIR/${wasm}.wasm" ]] || error "Missing WASM: ${wasm}.wasm"
done

# ── Set up mainnet identity ───────────────────────────────────────────────────
IDENTITY="mainnet-deployer"
info "Importing mainnet deployer key..."
stellar keys add "$IDENTITY" --secret-key "$MAINNET_DEPLOYER_SECRET" 2>/dev/null || \
  stellar keys add "$IDENTITY" --secret-key --overwrite <<< "$MAINNET_DEPLOYER_SECRET" 2>/dev/null || \
  stellar keys generate "$IDENTITY" --secret-key "$MAINNET_DEPLOYER_SECRET"
DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")
info "Deployer: $DEPLOYER_ADDRESS"

# ── Add mainnet network config if not already present ─────────────────────────
stellar network add mainnet \
  --rpc-url "https://mainnet.sorobanrpc.com" \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  2>/dev/null || warning "mainnet network already configured"

# ── Upload insurance-market WASM ─────────────────────────────────────────────
info "Uploading insurance-market WASM to mainnet..."
IM_WASM_HASH=$(stellar contract upload \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --wasm "$WASM_DIR/insurance_market.wasm")
info "insurance-market WASM hash: $IM_WASM_HASH"

# ── Deploy anchor-stake ───────────────────────────────────────────────────────
# Mainnet USDC SAC — verify at https://stellar.expert/explorer/public
# Issuer: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
MAINNET_USDC_SAC="${MAINNET_USDC_SAC:-}"
[[ -n "$MAINNET_USDC_SAC" ]] || error "MAINNET_USDC_SAC not set — fetch from stellar.expert"

info "Deploying anchor-stake to mainnet..."
ANCHOR_STAKE_ID=$(stellar contract deploy \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --wasm "$WASM_DIR/anchor_stake.wasm" \
  --alias anchor-stake-mainnet)
info "anchor-stake: $ANCHOR_STAKE_ID"

stellar contract invoke \
  --id anchor-stake-mainnet \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --factory "$DEPLOYER_ADDRESS" \
  --usdc "$MAINNET_USDC_SAC"
info "anchor-stake initialized"

# ── Deploy market-factory ─────────────────────────────────────────────────────
info "Deploying market-factory to mainnet..."
FACTORY_ID=$(stellar contract deploy \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --wasm "$WASM_DIR/market_factory.wasm" \
  --alias market-factory-mainnet)
info "market-factory: $FACTORY_ID"

stellar contract invoke \
  --id market-factory-mainnet \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --insurance_market_wasm_hash "$IM_WASM_HASH" \
  --anchor_stake_contract "$ANCHOR_STAKE_ID"
info "market-factory initialized"

# ── Write watcher env ─────────────────────────────────────────────────────────
ENV_FILE="$SCRIPTS_DIR/../watcher/.env.mainnet"
cat > "$ENV_FILE" <<EOF
# Generated by deploy-mainnet.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
STELLAR_RPC_URL=https://mainnet.sorobanrpc.com
HORIZON_URL=https://horizon.stellar.org
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015

# Use a dedicated watcher keypair funded with XLM (not the deployer key)
WATCHER_SECRET_KEY=S...

MARKET_FACTORY_CONTRACT=$FACTORY_ID
ANCHOR_STAKE_CONTRACT=$ANCHOR_STAKE_ID
REDSTONE_CONTRACT=$MAINNET_REDSTONE_ORACLE
EOF
info "Watcher env written to $ENV_FILE"

echo ""
info "════════════════════════════════════════"
info "Mainnet deployment complete!"
info "════════════════════════════════════════"
echo ""
echo "  anchor-stake:    $ANCHOR_STAKE_ID"
echo "  market-factory:  $FACTORY_ID"
echo "  IM WASM hash:    $IM_WASM_HASH"
echo ""
info "Verify on Stellar Expert:"
echo "  https://stellar.expert/explorer/public/contract/$FACTORY_ID"
echo ""
warning "Next: create markets via create-market.ts with the factory address above"
