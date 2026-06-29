#!/usr/bin/env bash
# deploy-testnet.sh — full AnchorShield testnet deployment
set -euo pipefail

NETWORK="testnet"
CONTRACTS_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
SCRIPTS_DIR="$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warning() { echo -e "${YELLOW}[deploy]${NC} $*"; }
die()     { echo -e "\033[0;31m[deploy]${NC} $*"; exit 1; }

# Helper: run stellar deploy/upload and extract just the contract address or hash
# Stellar CLI 27 prints progress to stderr AND stdout; the address/hash is
# always the last non-empty line that matches a known pattern.
extract_address() { grep -E '^C[A-Z2-7]{55}$'; }
extract_hash()    { grep -E '^[a-f0-9]{64}$'; }

# ── Step 0: verify toolchain ──────────────────────────────────────────────────
stellar --version >/dev/null 2>&1 || die "stellar-cli not found: winget install Stellar.StellarCLI"
cargo --version   >/dev/null 2>&1 || die "cargo not found"
info "Toolchain OK"

# ── Step 1: build ─────────────────────────────────────────────────────────────
info "Building contracts..."
cd "$CONTRACTS_DIR" && stellar contract build && cd - >/dev/null
for f in anchor_stake insurance_market market_factory; do
  [[ -f "$WASM_DIR/${f}.wasm" ]] || die "Missing $f.wasm"
done
info "Build complete"

# ── Step 2: identity ──────────────────────────────────────────────────────────
IDENTITY="deployer"
if ! stellar keys ls 2>/dev/null | grep -q "^${IDENTITY}$"; then
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
else
  warning "Using existing '$IDENTITY' identity"
fi
DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")
info "Deployer: $DEPLOYER_ADDRESS"

# ── Step 3: upload insurance-market WASM ─────────────────────────────────────
info "Uploading insurance-market WASM..."
IM_WASM_HASH=$(stellar contract upload \
  --source "$IDENTITY" --network "$NETWORK" \
  --wasm "$WASM_DIR/insurance_market.wasm" 2>&1 | extract_hash)
[[ -n "$IM_WASM_HASH" ]] || die "Failed to capture WASM hash"
info "WASM hash: $IM_WASM_HASH"
sleep 10

# ── Step 4: deploy anchor-stake ───────────────────────────────────────────────
info "Deploying anchor-stake..."
ANCHOR_STAKE_ID=$(stellar contract deploy \
  --source "$IDENTITY" --network "$NETWORK" \
  --wasm "$WASM_DIR/anchor_stake.wasm" 2>&1 | extract_address)
[[ -n "$ANCHOR_STAKE_ID" ]] || die "Failed to capture anchor-stake address"
info "anchor-stake: $ANCHOR_STAKE_ID"
sleep 20

TESTNET_USDC_SAC="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
info "Initializing anchor-stake..."
stellar contract invoke \
  --id "$ANCHOR_STAKE_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- initialize \
  --admin   "$DEPLOYER_ADDRESS" \
  --factory "$DEPLOYER_ADDRESS" \
  --usdc    $TESTNET_USDC_SAC
info "anchor-stake initialized"
sleep 10

# ── Step 5: deploy market-factory ────────────────────────────────────────────
info "Deploying market-factory..."
FACTORY_ID=$(stellar contract deploy \
  --source "$IDENTITY" --network "$NETWORK" \
  --wasm "$WASM_DIR/market_factory.wasm" 2>&1 | extract_address)
[[ -n "$FACTORY_ID" ]] || die "Failed to capture factory address"
info "market-factory: $FACTORY_ID"
sleep 20

info "Initializing market-factory..."
stellar contract invoke \
  --id "$FACTORY_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- initialize \
  --admin                       "$DEPLOYER_ADDRESS" \
  --insurance_market_wasm_hash  "$IM_WASM_HASH" \
  --anchor_stake_contract       "$ANCHOR_STAKE_ID"
info "market-factory initialized"
sleep 10

# ── Step 6: create USDC depeg market ─────────────────────────────────────────
REFLECTOR_TESTNET="CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"
ORACLE_CONTRACT="${ORACLE_CONTRACT:-$REFLECTOR_TESTNET}"
EXPIRY=$(date -d "+30 days" +%s 2>/dev/null || python3 -c "import time; print(int(time.time())+2592000)")
info "Creating USDC depeg market (oracle: $ORACLE_CONTRACT, expiry: $EXPIRY)..."
stellar contract invoke \
  --id "$FACTORY_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- create_market \
  --label                  "USDC depeg < \$0.995 for 1hr" \
  --collateral_token       $TESTNET_USDC_SAC \
  --covered_asset_symbol   USDC \
  --oracle_contract        $ORACLE_CONTRACT \
  --depeg_threshold        99500000000000 \
  --breach_duration_seconds 3600 \
  --expiry_timestamp       "$EXPIRY"
info "Market created"

# ── Step 7: write watcher env ─────────────────────────────────────────────────
ENV_FILE="$SCRIPTS_DIR/../watcher/.env.testnet"
cat > "$ENV_FILE" <<EOF
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
WATCHER_SECRET_KEY=S...
MARKET_FACTORY_CONTRACT=$FACTORY_ID
ANCHOR_STAKE_CONTRACT=$ANCHOR_STAKE_ID
ORACLE_CONTRACT=$ORACLE_CONTRACT
EOF
info "Wrote $ENV_FILE"

echo ""
info "════ Deployment complete ════"
echo "  anchor-stake:   $ANCHOR_STAKE_ID"
echo "  market-factory: $FACTORY_ID"
echo "  WASM hash:      $IM_WASM_HASH"
echo "  https://stellar.expert/explorer/testnet/contract/$FACTORY_ID"
