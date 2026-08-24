<div align="center">
<img width="400" height="400" alt="image" src="https://github.com/user-attachments/assets/1a723a49-5c32-46f6-a266-26786c1ff23c" />


<h1 align="center">AnchorShield</h1>
<p align="center">
<strong>Parametric hedging and risk intelligence for Stellar's stablecoin economy.</strong>
</p>
</div>

AnchorShield is a production-grade, fully on-chain DeFi protocol built on Stellar's Soroban VM. It allows users to hedge against stablecoin depeg events — USDC, EURC, MGUSD, PYUSD — through permissionless binary outcome markets. Settlement is driven entirely by the Reflector oracle with no human claims process, no adjusters, and zero latency.

**Status:** Live on Stellar Mainnet.

📄 **[Litepaper](./Litepaper.md)** &nbsp;|&nbsp; 📚 **[Documentation](https://docs.anchorshield.xyz/)** &nbsp;|&nbsp; 🐦 **[X (Twitter)](https://x.com/AnchorShieldApp)** &nbsp;|&nbsp; 🏆

---

## The Architecture

### 1. Hedge Markets
Each market is an isolated, binary outcome smart contract: *"Will USDC drop below $0.995 for 1 continuous hour before expiry?"*

- **Underwrite**: Underwriters deposit 1 USDC as collateral and receive 1 YES + 1 NO token.
- **Trade Cover**: YES tokens are sold on the in-contract orderbook as cover. The buyer pays a premium and holds the payout right.
- **Permissionless Settlement**: Settlement is permissionless. Anyone can call `try_settle()`, which forces the contract to read the Reflector Mainnet oracle, run the breach timer, and settle the market mathematically.
- **Payouts**:
  - **YES wins (Depeg confirmed)** → Every YES token redeems $1 USDC.
  - **NO wins (No depeg before expiry)** → Every NO token redeems $1 USDC.

### 2. Anchor Confidence Rating (ACR)
AnchorShield acts as the risk intelligence layer for Stellar. The ACR is a composite, on-chain signal quantifying how reliable an anchor is.
- **Off-Chain Oracle (Watcher)**: Actively pings production SEP-24 endpoints for major anchors (e.g., Circle, MoneyGram) to evaluate hardware health, API latency, and payout volume.
- **On-Chain Risk State**: The off-chain worker aggregates these metrics and pushes them to the `AnchorStake` smart contract, making real-time anchor health readable by any Soroban contract or DeFi protocol.

### 3. Decentralized Crank (Watcher Bot)
AnchorShield uses a "Decentralized Crank" architecture to guarantee zero-latency execution without relying on user interaction.
- The off-chain Node.js Watcher Bot polls the Stellar Mainnet every 60 seconds.
- It actively executes `fill_orders()` to match pending orders and `try_settle()` to trigger oracle validations.
- Transactions are broadcasted using a prioritized `100,000 stroops` inclusion fee to guarantee instant block inclusion regardless of network congestion.

### 4. Yield Stack Routing (DeFindex)
To maximize capital efficiency, idle collateral locked in the Insurance Market vault is structurally designed to route into DeFindex yield blends. 
*(Note: For Demo Day, the 6.4% APY is mocked in the frontend UI to demonstrate the UX, while the underlying `yield_.rs` integration will be fully activated post-hackathon).*

---

## Stellar Mainnet Contracts

AnchorShield is fully deployed and actively running on the Stellar Mainnet.

| Component | Mainnet Contract ID |
|---|---|
| **Market Factory** | `CCYCUQNKQOC222ZG4TZAAMGZHURTAUEUFOL5OFXFUZEHTZI2JVFJPNZ3` |
| **Anchor Stake & ACR** | `CCDZ4AY4AAAM4KRHYO5OZIQZITSQJZ7DD6NG76TVDRABW5WIYD4AEGLL` |
| **Reflector Oracle** | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` |
| **USDC (Circle)** | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| **EURC (Circle)** | `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV` |

---

## Repository Structure

```text
anchorshield/
├── contracts/                  Soroban smart contracts (Rust)
│   ├── interfaces/             SEP-40 oracle + AnchorStake client traits
│   ├── anchor-stake/           Anchor Confidence Rating (ACR) contract
│   ├── insurance-market/       Core vault: mint, orderbook, settlement, claim
│   └── market-factory/         Deploys and registers isolated market instances
├── watcher/                    Decentralized Crank (Node.js + TS)
│   └── src/
│       ├── index.ts            Cron scheduler (every 60s)
│       ├── settler.ts          try_settle() + fill_orders() runner
│       ├── acr.ts              Live SEP-24 ping & Risk Score generation
│       └── soroban.ts          High-priority Mainnet RPC transactions
├── frontend/                   Next.js 15 App Router Frontend
│   └── src/app/
│       ├── page.tsx            Landing page
│       └── app/                Dashboard, Risk Curve, Stats, Market detail pages
└── deploy_all.mjs              Automated Mainnet deployment pipeline
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | Rust Stable, `soroban-sdk 26`, `wasm32v1-none` target |
| **Oracle** | Reflector Mainnet Network (`CAFJZQW...`) |
| **Decentralized Crank** | Node.js 20, TypeScript 5, `@stellar/stellar-sdk` 16.1.0 |
| **Frontend UI** | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **Data Visualization** | `lightweight-charts` v5.2 (Real-time Oracle Candles), Recharts |
| **Web3 Wallet** | Freighter via `@stellar/freighter-api` |

---

## Building Locally

### 1. Build Contracts
```bash
rustup target add wasm32v1-none
cargo install stellar-cli --locked

cd contracts
stellar contract build
```

### 2. Run Decentralized Crank
```bash
cd watcher
npm install
npm run build
npm run dev
```

### 3. Run Frontend UI
```bash
cd frontend
npm install
npm run dev
```
