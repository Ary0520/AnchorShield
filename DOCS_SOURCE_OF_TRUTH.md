# AnchorShield - Documentation Source of Truth (Audit)

## Overview
This document contains every factual claim the docs are allowed to make based on a strict audit of the current smart contract and frontend codebase. **No features outside of this list should be promised or hallucinated in the documentation.**

## 1. Smart Contracts
### 1.1 Market Factory (`contracts/market-factory`)
- **Responsibility:** Deploys new `InsuranceMarket` contracts and maintains a registry of them.
- **Admin Constraints:** Only the admin (`DataKey::Admin`) can call `create_market`, `update_wasm_hash`, and `delete_market`.
- **Created Market Config:** Each market records `market_id`, `label`, `collateral_token` (USDC), `covered_asset` (e.g. USDC/EURC), `oracle_contract`, `depeg_threshold`, `breach_duration_seconds`, `expiry_timestamp`, and `anchor_id` (optional).
- **Source:** `contracts/market-factory/src/lib.rs`

### 1.2 Insurance Market (`contracts/insurance-market`)
- **Responsibility:** Handles minting of YES/NO tokens, order book limit orders (buy cover/underwrite), DeFindex yield generation, and settlement logic.
- **Minting Mechanics:** Users deposit `X` collateral (USDC) to mint `X` YES tokens and `X` NO tokens simultaneously (`mint_complete_set`).
- **Yield / DeFindex Fallback:** The contract gracefully calls `try_invoke_contract` on the DeFindex vault (`yield_.rs`). If no vault is set, or if DeFindex is unavailable, the transaction succeeds but USDC remains idle in the contract. **Yield is not guaranteed.**
- **Order Book:** Completely on-chain order matching. Users can place limit orders to trade YES and NO tokens for USDC.
- **Source:** `contracts/insurance-market/src/lib.rs`, `yield_.rs`

### 1.3 Settlement Logic (`contracts/insurance-market/src/settlement.rs`)
- **Function:** `try_settle` can be called permissionlessly by anyone (typically the Watcher).
- **Flash-Crash Protection:** The contract reads the Reflector Oracle. If price < threshold, it marks `BreachStartedAt`. If price recovers >= threshold before `breach_duration_seconds` is met, the timer is wiped (`None`).
- **Trigger Condition:** Payout triggers *only* if `now.saturating_sub(started_at) >= breach_duration`.
- **Payout (YES wins):** The market immediately closes. NO tokens become worthless. YES holders can claim 1 USDC per YES token + proportional yield.
- **Expiry (NO wins):** If `expiry_timestamp` is reached without a sustained breach, the market permanently closes. YES tokens become worthless. NO holders claim 1 USDC per NO token + proportional yield.
- **Source:** `contracts/insurance-market/src/settlement.rs`

### 1.4 Anchor Stake / ACR (`contracts/anchor-stake`)
- **Responsibility:** Tracks Anchor Confidence Ratio (ACR).
- **Mechanic:** Computes a simple ratio of Underwriting Capital (NO Tokens minted against an anchor) vs. Total Covered Capital.
- **Current Status:** It directly tracks on-chain data based on the Anchor ID provided during Market creation. It currently DOES NOT pull off-chain operational data, reserves, or external ratings.
- **Source:** `contracts/anchor-stake/src/lib.rs`

## 2. Automations & Integrations
### 2.1 Watcher (`watcher/`)
- **Tech Stack:** Node.js + `node-cron`.
- **Execution:** Runs every 60 seconds.
- **Responsibilities:** 
  1. Queries the Factory for all active markets.
  2. Calls `try_settle` on each open market.
  3. Calls `fill_orders` on each open market to match crossed limit orders.
  4. Reads ACR scores and logs them.
- **Source:** `watcher/src/index.ts`

### 2.2 Oracle (`frontend/src/lib/oracle.ts` & `settlement.rs`)
- **Provider:** Reflector on Stellar.
- **Freshness Guard:** The smart contract explicitly rejects oracle data older than `ORACLE_FRESHNESS_SECONDS`. If stale, `try_settle` gracefully exits and waits for the next tick.
- **Source:** `contracts/insurance-market/src/settlement.rs`

## 3. Frontend & Admin
- **Tech Stack:** Next.js 15 App Router + Tailwind CSS.
- **AI Risk Analyst:** Present in the UI to answer queries, but its calculations are LLM-generated based on the current context, not deterministically on-chain.
- **Admin Dashboard:** Exists to deploy parameter-verified markets and delete them via `delete_market`.

## 4. Risks to Disclose Transparently
1. **Oracle Risk:** If Reflector goes down or reports false data for a sustained duration, markets can settle incorrectly or fail to settle.
2. **DeFindex Strategy Risk:** If the underlying yield strategy fails, underwriting collateral could be exposed to principal loss.
3. **Watcher Downtime Risk:** If the Node.js watcher goes offline, limit orders won't match automatically, and settlement will be delayed until a user or bot manually calls `try_settle`.
