# AnchorShield
<img width="1012" height="569" alt="image" src="https://github.com/user-attachments/assets/606df59d-9f01-43da-8ba7-8b91a2bc1357" />
**Parametric hedging and risk intelligence for Stellar's stablecoin economy.**

AnchorShield is a fully on-chain protocol built on Stellar's Soroban platform. It lets users hedge against stablecoin depeg events — USDC, EURC, MGUSD, PYUSD — through permissionless binary outcome markets. Settlement is driven entirely by the Reflector oracle with no human claims process, no adjusters, and no waiting.

Live on Stellar Testnet · [anchorshield.vercel.app](https://anchorshield.vercel.app)

---

## What it does

### Hedge Markets

Each market is a binary outcome contract: "Will USDC drop below $0.995 for 1 continuous hour before expiry?"

- Underwriters deposit USDC → receive equal YES + NO tokens
- YES tokens are sold as cover — the buyer pays a premium, holds the payout right
- Settlement is permissionless: anyone calls `try_settle()`, the contract reads Reflector oracle, runs the breach timer, and settles automatically
- YES wins (depeg confirmed) → every YES token redeems $1 USDC
- NO wins (no depeg before expiry) → every NO token redeems $1 USDC
- The YES price in the order book = market-implied probability of the depeg

### Anchor Trust Score

The Anchor Trust Score is AnchorShield's risk intelligence primitive — a composite, on-chain signal that quantifies how aligned an anchor is with the users who depend on their stablecoin.

In v1 the score reflects the **capital stake ratio**: how much of an anchor's own USDC is staked against the total cover outstanding on their market.

```
Capital Stake Ratio = anchor_staked_usdc / total_yes_tokens_outstanding
```

The score is published on-chain and readable by any Soroban contract, wallet, or DeFi protocol:

```rust
let score = anchor_stake.get_acr(&anchor_address);
// 10_000 = 1.00x · 20_000 = 2.00x (AAA)
```

The v2 roadmap expands this to a multi-signal composite incorporating settlement success rate, oracle uptime, historical payout data, and anchor withdrawal reliability — making AnchorShield the risk intelligence layer for Stellar's anchor economy.

---

## Protocol mechanics

```
$1 USDC = 1 YES token + 1 NO token   (a complete set)
```

1. **Underwrite**: deposit USDC → mint YES + NO → place sell order for YES at your target premium
2. **Buy cover**: place buy order for YES → pay premium → hold payout right
3. **Watcher**: calls `fill_orders()` every 60s to match buyers and sellers
4. **Settlement**: calls `try_settle()` every 60s; contract reads Reflector oracle, applies 1-hour breach timer
5. **Claim**: after settlement, winning token holders call `claim()` → receive $1 USDC per token

---

## Repository

```
anchorshield/
├── contracts/                  Soroban smart contracts (Rust)
│   ├── interfaces/             SEP-40 oracle + AnchorStake client traits
│   ├── anchor-stake/           Anchor Trust Score contract
│   ├── insurance-market/       Core: mint, order book, settlement, claim
│   └── market-factory/         Deploys and registers market instances
├── watcher/                    Off-chain Node.js 20 + TypeScript service
│   └── src/
│       ├── index.ts            Cron scheduler (every 60s)
│       ├── settler.ts          try_settle() + fill_orders() runner
│       ├── redstone.ts         Reflector oracle price reader
│       └── soroban.ts          RPC + transaction helpers
├── frontend/                   Next.js 15 frontend (app router)
│   └── src/app/
│       ├── page.tsx            Landing page
│       └── app/
│           ├── page.tsx        Risk Curve dashboard
│           ├── markets/        Hedge Markets list + detail pages
│           ├── anchors/        Anchor Trust Score page
│           └── stats/          Protocol Stats page
└── scripts/
    ├── create-markets.mjs      Create testnet markets via factory
    └── create-test-market.mjs  Create a short-expiry test market
```

---

## Tech stack

| Layer | What we use |
|---|---|
| Smart contracts | Rust stable, `soroban-sdk 26`, `wasm32v1-none` target |
| Oracle | Reflector Network (SEP-40 compatible), testnet contract `CCYOZJC...` |
| Watcher | Node.js 20, TypeScript 5, `@stellar/stellar-sdk` 13.3, `node-cron` |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS 3 |
| Charts | `lightweight-charts` v5.2 (oracle price), Recharts (risk curve) |
| Wallet | Freighter via `@stellar/freighter-api` 4.0 |
| Contract reads | Soroban RPC `simulateTransaction` — no wallet needed, no fees |

> DeFindex yield integration is stubbed (`yield_.rs` is a no-op). USDC is held directly in the market contract. This is intentional for testnet — yield is a post-mainnet enhancement.

---

## Prerequisites

**Contracts:**
```bash
rustup default stable
rustup target add wasm32v1-none   # requires Rust >= 1.84
cargo install stellar-cli --locked
```

**Watcher / Scripts:**
```bash
node --version   # >= 20.0.0
```

**Frontend:**
```bash
cd frontend
npm install
```

---

## Running locally

### 1. Build contracts

```bash
cd contracts
stellar contract build
# → target/wasm32v1-none/release/insurance_market.wasm
# → target/wasm32v1-none/release/anchor_stake.wasm
# → target/wasm32v1-none/release/market_factory.wasm
```

### 2. Run tests

```bash
cargo test -p anchor-stake      --features testutils
cargo test -p insurance-market  --features testutils
cargo test -p market-factory    --features testutils
```

24 tests, 24 passing across all contracts.

### 3. Start the watcher

```bash
cd watcher
npm install
cp .env.testnet .env   # uses existing testnet deployment
npm run build
npm start
```

The watcher logs every 60s:
- `[Settler]` — try_settle() result per market
- `[Matcher]` — fill_orders() result per market

### 4. Start the frontend

```bash
cd frontend
cp .env.testnet .env.local
npm run dev
# → http://localhost:3000
```

---

## Testnet contracts

These are live on Stellar Testnet:

| Contract | Address |
|---|---|
| Market Factory | `CDPLCH2HKDALDYNYDK22BTDNCHGB63S4WZCP7WJXYXIHKSCA3BG2B47R` |
| Anchor Stake | `CDSKDTQKDQ7GZWCM7MKZXMDVQJQMLZIMHJ3PGAPSPVUQSUXBFGMJBXW` |
| Testnet USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Reflector Oracle | `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63` |

Active markets: USDC Depeg (Market 0), EURC Depeg (Market 1).

---

## Creating a test market

```bash
cd scripts
node create-test-market.mjs
# Creates a 10-minute USDC depeg market with 60s breach window
# → http://localhost:3000/app/markets/<id>
```

---

## What's stubbed for mainnet

| Component | Status |
|---|---|
| DeFindex yield | `yield_.rs` is a no-op. USDC stays in contract. |
| `update_cover_outstanding` auth | Any caller accepted. Needs factory-verified caller check. |
| `unstake` settlement verification | Trusts caller. Add on-chain market state check. |
| Anchor SEP-24 monitoring | Watcher has placeholder logic. Needs real anchor account monitoring. |
| Anchor Trust v2 signals | Oracle uptime, settlement latency, withdrawal failures — v2 roadmap. |

---

## Reference

- [Reflector oracle](https://reflector.network)
- [Soroban SDK docs](https://docs.rs/soroban-sdk)
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli)
- [Freighter API](https://docs.freighter.app)
- [Stellar JS SDK](https://stellar.github.io/js-stellar-sdk)
