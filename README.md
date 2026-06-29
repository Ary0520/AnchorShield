# AnchorShield

Parametric insurance protocol on Stellar's Soroban smart contract platform.

Insures against machine-verifiable failures in Stellar's ecosystem — stablecoin depegs (USDC, EURC, MGUSD, PYUSD) and anchor settlement failures — with permissionless, oracle-driven settlement and no human claims process.

## How it works

- `$1 USDC = 1 YES token + 1 NO token` (a complete set)
- Underwriters deposit USDC, mint a complete set, sell YES tokens (insurance cover), keep NO
- YES price = market-implied probability of a depeg event
- If a depeg is confirmed on-chain via RedStone oracle → YES holders claim $1 per token
- If the market expires without a depeg → NO holders claim $1 per token
- Idle collateral earns yield via DeFindex → Blend v2 (post-MVP)

**The differentiator:** Anchors (MoneyGram, Bitso, Airtm) can stake their own USDC as primary underwriters for their own market, creating the **Anchor Confidence Ratio (ACR)** — a public on-chain trust signal readable by any contract, wallet, or DeFi protocol.

```
ACR = anchor_staked_usdc / total_yes_tokens_sold
```

---

## Repository structure

```
anchorshield/
├── contracts/          Soroban smart contracts (Rust, soroban-sdk 26)
│   ├── interfaces/     SEP-40 oracle + AnchorStake client traits (rlib)
│   ├── anchor-stake/   ACR tracking contract
│   ├── insurance-market/ Core market: mint, orderbook, settlement, claim
│   └── market-factory/ Deploys insurance-market instances
├── watcher/            Off-chain Node.js 20 + TypeScript service
│   └── src/            Settlement trigger, order matching, ACR logging
├── scripts/            Deployment + seeding scripts
│   ├── deploy-testnet.sh
│   ├── deploy-mainnet.sh
│   ├── create-market.ts
│   └── seed-testnet.ts
└── README.md
```

---

## Prerequisites

### Contracts

```bash
# Rust stable
rustup default stable
rustup target add wasm32v1-none   # requires Rust >= 1.84

# Stellar CLI
cargo install stellar-cli --locked
stellar --version
```

### Watcher / Scripts

```bash
node --version   # >= 20.0.0
npm --version
```

---

## Contracts

### Build

```bash
cd contracts
stellar contract build
# Output: target/wasm32v1-none/release/{anchor_stake,insurance_market,market_factory}.wasm
```

### Test

```bash
# All contracts (requires MSVC on Windows or gcc on Linux/macOS)
cargo test -p anchor-stake      --features testutils
cargo test -p insurance-market  --features testutils
cargo test -p market-factory    --features testutils
```

Current test coverage: **24 tests, 24 passing**

| Contract | Tests |
|---|---|
| anchor-stake | 7 |
| insurance-market | 14 (incl. oracle mock YES/NO paths, stale oracle) |
| market-factory | 3 |

---

## Testnet deployment

```bash
# 1. Add testnet network config (one-time)
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# 2. Deploy all contracts + initialize + create first market
TESTNET_REDSTONE_ORACLE=C... ./scripts/deploy-testnet.sh

# The script will:
#   - Build contracts
#   - Generate a funded testnet identity
#   - Upload insurance-market WASM
#   - Deploy + initialize anchor-stake
#   - Deploy + initialize market-factory
#   - Create a USDC depeg market (if TESTNET_REDSTONE_ORACLE is set)
#   - Write watcher/.env.testnet
```

Get the RedStone testnet oracle address from:
https://docs.redstone.finance/docs/smart-contract-devs/get-started/stellar

---

## Watcher service

```bash
cd watcher
npm install
cp .env.example .env
# Fill in: WATCHER_SECRET_KEY, MARKET_FACTORY_CONTRACT, ANCHOR_STAKE_CONTRACT, REDSTONE_CONTRACT

npm run build
npm start
```

The watcher runs every 60 seconds and:
1. Calls `try_settle()` on all open markets (contract handles oracle read + breach timer)
2. Calls `fill_orders()` on all open markets (matches buy/sell pairs)
3. Logs ACR scores every 10 ticks

---

## Creating markets

After deployment, create additional markets via the factory:

```bash
cd scripts
npm install

# Example: EURC depeg market
DEPLOYER_SECRET_KEY=S... \
MARKET_FACTORY_CONTRACT=C... \
USDC_SAC=C... \
REDSTONE_CONTRACT=C... \
ts-node create-market.ts \
  --network testnet \
  --symbol EURC \
  --threshold 99500000000000 \
  --breach 3600 \
  --label "EURC depeg < $0.995 for 1hr"
```

---

## Addresses

Fill in `contracts/addresses.rs` before mainnet deployment.

| Asset | Source |
|---|---|
| Testnet USDC SAC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNFESNU4W4III5JEHE74XX53P6BYOS` |
| Mainnet USDC SAC | https://stellar.expert (search issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`) |
| Mainnet EURC SAC | https://stellar.expert (issuer `GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP`) |
| Mainnet MGUSD SAC | https://stellar.expert (MoneyGram, launched Jun 2026) |
| Mainnet PYUSD SAC | https://stellar.expert (PayPal, launched Sep 2025) |
| RedStone oracle | https://docs.redstone.finance/docs/smart-contract-devs/get-started/stellar |
| DeFindex USDC vault | `CAEJL2XKGLSWCPKSVVRYAWLQKE4DS24YCZX53CLUMWGOVEOERSAZH5UM` |

---

## What's stubbed (MVP)

| Component | Status | Notes |
|---|---|---|
| DeFindex yield | Stubbed (no-op) | `yield_.rs` holds USDC in contract. Integrate post-testnet. |
| `update_cover_outstanding` auth | Any caller accepted | Tighten to factory-verified market contracts before mainnet |
| `unstake` settlement check | Trusts caller | Add on-chain market state verification before mainnet |
| Anchor SEP-24 monitoring | Placeholder accounts | Replace with real anchor distribution accounts |

---

## Tech stack

| Layer | Stack |
|---|---|
| Contracts | Rust stable, soroban-sdk 26, Protocol 26 |
| Build | `stellar contract build` → `wasm32v1-none` |
| Oracle | RedStone Finance, SEP-40 push model |
| Watcher | Node.js 20, TypeScript 5, `@stellar/stellar-sdk` 13.3 |
| Scripts | ts-node, same SDK |
| Yield (future) | DeFindex → Blend v2 |

---

## Reference

- [Soroban SDK docs](https://docs.rs/soroban-sdk)
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli)
- [SEP-40 oracle standard](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md)
- [RedStone on Stellar](https://docs.redstone.finance/docs/smart-contract-devs/get-started/stellar)
- [DeFindex](https://deepwiki.com/paltalabs/defindex)
- [Stellar JS SDK](https://stellar.github.io/js-stellar-sdk)
- [Horizon API](https://developers.stellar.org/docs/data/apis/horizon)
