#!/usr/bin/env bash
# deploy-testnet.sh — full AnchorShield testnet deployment
#
# Prerequisites:
#   1. stellar-cli installed  (cargo install stellar-cli --locked)
#   2. Rust + wasm32v1-none target  (rustup target add wasm32v1-none)
#   3. Contracts built:  cd contracts && stellar contract build
#
# Usage:
#   chmod +x scripts/deploy-testnet.sh
#   ./scripts/deploy-testnet.sh
#
# On success, prints all contract addresses and writes
# a .env file for the watcher at watcher/.env.testnet

set -euo pipefail

NETWORK="testnet"
CONTRACTS_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
SCRIPTS_DIR="$(dirname "$0")"

# ── Ensure stellar-cli is on PATH for bash (winget installs to Windows path) ──
if ! command -v stellar &>/dev/null; then
  # winget installs to "C:\Program Files (x86)\Stellar CLI\" — add to PATH
  export PATH="$PATH:/c/Program Files (x86)/Stellar CLI"
  if ! command -v stellar &>/dev/null; then
    echo "[deploy] stellar-cli not found. Install with: winget install Stellar.StellarCLI"
    exit 1
  fi
fi

# ── Colour output helpers ────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warning() { echo -e "${YELLOW}[deploy]${NC} $*"; }
error()   { echo -e "${RED}[deploy]${NC} $*"; exit 1; }

# ── Step 0: verify toolchain ─────────────────────────────────────────────────
info "Checking toolchain..."
stellar --version || { error "stellar-cli not found. Install with: winget install Stellar.StellarCLI"; }
cargo --version   || error "cargo not found"

# ── Step 1: build contracts ───────────────────────────────────────────────────
info "Building contracts (stellar contract build)..."
cd "$CONTRACTS_DIR"
stellar contract build
cd - > /dev/null

# Verify WASM files exist
for wasm in anchor_stake insurance_market market_factory; do
  [[ -f "$WASM_DIR/${wasm}.wasm" ]] || error "Missing WASM: ${wasm}.wasm"
done
info "All 3 WASM files present in $WASM_DIR"

# ── Step 2: set up testnet identity ─────────────────────────────────────────
IDENTITY="deployer"
info "Setting up identity '$IDENTITY'..."

if [[ -n "${DEPLOYER_SECRET:-}" ]]; then
  # Use provided secret key (e.g. from Freighter wallet)
  # stellar keys add accepts a secret key from stdin
  echo "$DEPLOYER_SECRET" | stellar keys add "$IDENTITY" --secret-key 2>/dev/null || \
  stellar keys add "$IDENTITY" --secret-key "$DEPLOYER_SECRET" 2>/dev/null || true
  info "Using provided DEPLOYER_SECRET key"
elif ! stellar keys ls 2>/dev/null | grep -q "^$IDENTITY$"; then
  # Generate a new key and fund it via Friendbot
  stellar keys generate "$IDENTITY" --network "$NETWORK"
  info "Funding '$IDENTITY' via Friendbot..."
  stellar keys fund "$IDENTITY" --network "$NETWORK"
else
  warning "Identity '$IDENTITY' already exists — using existing key"
fi

DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")
info "Deployer address: $DEPLOYER_ADDRESS"

# ── Step 3: upload insurance-market WASM ─────────────────────────────────────
# The factory needs this hash to deploy new market instances.
info "Uploading insurance-market WASM..."
IM_WASM_HASH=$(stellar contract upload \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --wasm "$WASM_DIR/insurance_market.wasm")
info "insurance-market WASM hash: $IM_WASM_HASH"

# Wait for ledger close before next transaction (prevents TxBadSeq)
sleep 20

# ── Step 4: deploy anchor-stake ───────────────────────────────────────────────
# Must be deployed first — factory needs its address.
# Our anchor-stake uses initialize(), not __constructor, so deploy then invoke.
info "Deploying anchor-stake..."
ANCHOR_STAKE_ID=$(stellar contract deploy \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --wasm "$WASM_DIR/anchor_stake.wasm" \
  --alias anchor-stake)
info "anchor-stake deployed: $ANCHOR_STAKE_ID"

# Wait for contract to be available on-chain before invoking it
sleep 20

# Initialize anchor-stake
# Args: admin(Address), factory(Address placeholder), usdc(Address)
# factory will be updated after market-factory is deployed
# For now use deployer address as factory placeholder — update after
TESTNET_USDC_SAC="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
info "Initializing anchor-stake..."
stellar contract invoke \
  --id "$ANCHOR_STAKE_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --factory "$DEPLOYER_ADDRESS" \
  --usdc $TESTNET_USDC_SAC
info "anchor-stake initialized"

# Wait for ledger close
sleep 20

# ── Step 5: deploy market-factory ─────────────────────────────────────────────
info "Deploying market-factory..."
FACTORY_ID=$(stellar contract deploy \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --wasm "$WASM_DIR/market_factory.wasm" \
  --alias market-factory)
info "market-factory deployed: $FACTORY_ID"

# Wait for contract to be available on-chain before invoking it
sleep 20

# Initialize factory with the insurance-market WASM hash and anchor-stake address
info "Initializing market-factory..."
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --insurance_market_wasm_hash "$IM_WASM_HASH" \
  --anchor_stake_contract "$ANCHOR_STAKE_ID"
info "market-factory initialized"

# Wait for ledger close
sleep 20

# ── Step 6: create the first USDC depeg market ───────────────────────────────
# Oracle: Reflector Network — SEP-40 compatible, verified on Stellar's official
# oracle provider list: https://developers.stellar.org/docs/data/oracles/oracle-providers
# Using the "External CEXs & DEXs" feed which covers USDC, EURC, PYUSD, XLM, BTC.
# RedStone's Stellar doc page returned 404 as of June 2026; Reflector is the
# production-ready SEP-40 oracle already integrated with DeFindex.
REFLECTOR_TESTNET="CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"
ORACLE_CONTRACT="${ORACLE_CONTRACT:-$REFLECTOR_TESTNET}"
info "Oracle: $ORACLE_CONTRACT (Reflector testnet — External CEXs/DEXs)"

# Expiry: 30 days from now
EXPIRY=$(date -d "+30 days" +%s 2>/dev/null || python3 -c "import time; print(int(time.time()) + 2592000)")
info "Creating USDC depeg market (expiry: $EXPIRY)..."
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- create_market \
  --label "USDC depeg < \$0.995 for 1hr" \
  --collateral_token $TESTNET_USDC_SAC \
  --covered_asset_symbol USDC \
  --oracle_contract $ORACLE_CONTRACT \
  --depeg_threshold 99500000000000 \
  --breach_duration_seconds 3600 \
  --expiry_timestamp "$EXPIRY"
  # --anchor_id is omitted → CLI passes None automatically
info "USDC depeg market created"

# ── Step 7: write watcher .env ───────────────────────────────────────────────
ENV_FILE="$SCRIPTS_DIR/../watcher/.env.testnet"
cat > "$ENV_FILE" <<EOF
# Generated by deploy-testnet.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# IMPORTANT: Replace with the watcher's own funded keypair (NOT the deployer key)
WATCHER_SECRET_KEY=S...

MARKET_FACTORY_CONTRACT=$FACTORY_ID
ANCHOR_STAKE_CONTRACT=$ANCHOR_STAKE_ID
# Reflector oracle — External CEXs & DEXs feed (SEP-40 compatible)
# Source: https://developers.stellar.org/docs/data/oracles/oracle-providers
ORACLE_CONTRACT=$ORACLE_CONTRACT
EOF
info "Watcher env written to $ENV_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
info "════════════════════════════════════════"
info "Testnet deployment complete!"
info "════════════════════════════════════════"
echo ""
echo "  anchor-stake:    $ANCHOR_STAKE_ID"
echo "  market-factory:  $FACTORY_ID"
echo "  IM WASM hash:    $IM_WASM_HASH"
echo ""
echo "  Watcher env:     watcher/.env.testnet"
echo "  (copy to watcher/.env and fill in WATCHER_SECRET_KEY)"
echo ""
info "Verify on Stellar Expert:"
echo "  https://stellar.expert/explorer/testnet/contract/$FACTORY_ID"
