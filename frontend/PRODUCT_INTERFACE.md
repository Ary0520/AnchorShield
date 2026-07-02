# AnchorShield — Product Interface Specification

> This file defines the complete structure, layout, data, and interaction design
> of the AnchorShield application (not the landing page).
> It is design-agnostic on color/font — those are decided separately.
> Nothing here should be copy-pasted from Canary. This is AnchorShield's own product logic.

---

## GLOBAL SHELL

### Layout
- **Left sidebar** — fixed, ~220px wide, always visible
- **Main content area** — scrollable, takes remaining width
- **Top bar** — thin strip above everything: network badge + wallet connect only

### Top Bar
- Left: AnchorShield logo/wordmark
- Right: Network badge (Testnet / Mainnet) · Wallet button (Connect or shortened address)

### Left Sidebar — Navigation
Three primary sections. No icons-only — always show label alongside icon.

```
ANCHORSHIELD
─────────────────
[shield icon]  Hedge Markets       ← was "Insurance Markets"
[chart icon]   Risk Curve          ← new: the visual dashboard
[anchor icon]  Anchor Trust        ← was "Anchor ACR Scores"
[stats icon]   Protocol Stats
─────────────────
[book icon]    Docs  (external link)
[github icon]  GitHub (external link)
```

**Name changes rationale:**
- "Insurance Markets" → **"Hedge Markets"** — aligned with our copy direction (hedge, not insurance). More accurate legally. Sounds like a product, not an admin panel.
- "Anchor ACR Scores" → **"Anchor Trust"** — shorter, human. "ACR" means nothing to a new user at first glance. Trust is the concept.
- "Risk Curve" is new — this is the headline product view (explained below).

---

## PAGE 1: RISK CURVE (Default / Home page of app)

### Purpose
This is the first thing a user sees after the landing page CTA. It answers in 5 seconds:
"Which stablecoins are riskiest right now, according to the market?"

This is AnchorShield's most unique visual — the live, market-implied risk surface for Stellar stablecoins.
Canary has this as a sidebar chart. We make it the centerpiece.

### Layout
Split into two areas:
- **Top: Risk Curve Chart** (full width, ~300px tall)
- **Bottom: Market Cards Grid** (2-3 columns)

### Risk Curve Chart
**What it shows:**
A bar chart (or area chart) where:
- X-axis = each covered asset (USDC, EURC, USDT, DAI)
- Y-axis = implied probability of depeg (%) = best YES ask price in bps / 100
- Bars are color-coded: green = low risk (<0.5%), yellow = moderate (0.5-2%), red = elevated (>2%)

**Data source:**
- Live: read `get_orders()` on each market contract, find the lowest YES ask price
- If no orders exist: show "—" or "No market yet" for that bar
- Refresh every 30 seconds

**What it communicates:**
The market's collective judgment on which stablecoins carry the most peg risk right now.
A spike in USDT's bar means traders are pricing in higher risk — before a depeg even happens.

**Chart label:**
"Market-implied depeg probability — updated every 5 min via Reflector oracle"

**Annotation:**
Small info tooltip: "YES price ÷ 100 = implied probability. Higher = market expects more risk."

### Market Cards Grid (below the chart)
Each card represents one market. Shows enough to decide whether to click in.

**Card anatomy:**
```
┌────────────────────────────────────────────┐
│  [USDC logo]  USDC Depeg             Open  │
│  "Will USDC lose its $1 peg?"              │
│                                            │
│  YES price sparkline (7-day)  ~~~~~~~~     │
│                                            │
│  Implied prob:   0.31%                     │
│  Cover $1000:    $3.10    (= YES price×10) │
│  Collateral:     $45.20 locked             │
│  Expires:        Jul 30, 2026              │
│  ACR:            0.17x  (if anchor exists) │
│                                            │
│  [Buy Cover]            [Underwrite]       │
└────────────────────────────────────────────┘
```

**Data sources for card:**
- YES price (implied prob): lowest ask in `get_orders()` — if no orders, show "No asks yet"
- Sparkline: CANNOT do this from contract state alone — needs historical YES price data.
  For MVP: use the oracle price from Reflector as a proxy (show oracle price vs threshold).
  For v2: integrate Mercury indexer to pull historical YES prices from OrderFilled events.
- Collateral locked: `get_total_collateral()`
- State/Expiry: `get_state()`, `get_market()` from factory
- ACR: `get_acr(anchor_address)` — only show if anchor is registered for this market

**Card states:**
- Open: full interactive (Buy Cover, Underwrite buttons active)
- Expired: grayed out, shows "Expired — NO won" badge, "Claim" button if user has NO balance
- Settled: red badge "Settled — YES won", "Claim" button if user has YES balance

**Sorting/Filtering (top of grid):**
- Sort: "Highest risk first" (default) / "Lowest risk" / "Expiry soonest"
- Filter: "Open only" toggle

---

## PAGE 2: HEDGE MARKETS (Market Detail)

When user clicks a market card, this is the full detail page.

### Header
```
← Back to Risk Curve

[USDC logo]  Will USDC lose its $1 peg before Jul 30, 2026?
             [Open badge]

YES: 3.1¢    NO: 96.9¢    Implied prob: 3.1%    Collateral: $45.20    Expires: Jul 30 2026
```

**The question format is key.** "Will USDC lose its $1 peg?" is more human than "USDC depeg < $0.995 for 1hr."
It maps directly to how someone thinks about risk.

The sub-stats bar (YES price, NO price, implied prob, collateral, expiry) mirrors Canary's stats row — this is a proven UX pattern.
- YES price = best ask in order book
- NO price = 100¢ - YES price
- Implied prob = YES price in cents
- Collateral = `get_total_collateral()`

### Main Layout
Two-column layout:
- **Left (65%):** Chart + Order Book
- **Right (35%):** Trade Panel + Your Position

---

### LEFT COLUMN

#### A. Price Chart
**What chart to show:**
- Primary: **Oracle price chart** — the actual USDC/USD price from Reflector over time
  - Y-axis: price ($0.980 - $1.020)
  - Horizontal red dashed line at the depeg threshold ($0.995)
  - If the price line crosses below the red line, the breach timer starts
  - Time ranges: 1H / 6H / 1D / 1W
  - Chart type: Line chart (not candlestick — we're showing oracle price, not trade price)

**Why oracle price, not YES price:**
YES price would be ideal (it shows implied probability over time) but requires historical event data
which we can't reliably get from the RPC. Oracle price is live and meaningful — it directly shows
how close the covered asset is to the depeg threshold. When the line approaches the red threshold
line, cover becomes more valuable. This is the most honest, useful chart we can build today.

**Data source:** Reflector oracle `lastprice()` — call every 30s, store in-component state.
For time ranges beyond the last 30 seconds: this requires either Mercury indexer or Reflector's
`prices(asset, records)` function which returns last N records (confirmed in their interface).
Use `prices(asset, 288)` for 24h history (288 × 5min = 24h).

**Chart library:** Recharts (already in project) — LineChart with ReferenceLine for threshold.

**Below the chart — key resolution info:**
```
How this settles
─────────────────────────────────────────────
Underlying:    USDC/USD via Reflector oracle
Threshold:     $0.995 (0.5% below peg)
Breach window: Must stay below threshold for 1 hour continuously
Resolves YES:  Oracle confirms sustained breach → every YES token redeems $1 USDC
Resolves NO:   No breach before Jul 30, 2026 → every NO token redeems $1 USDC
Settlement:    Permissionless — anyone can call try_settle() · Watcher calls it every 60s
Oracle:        Reflector Network (CCYOZJCOPG34...) · Updates every 5 minutes
```

This "How this settles" block is critical for trust. Canary has it too. Users need to understand
exactly what triggers a payout before they commit capital.

#### B. Order Book
Displayed below the chart. Two tabs: **YES Orders** and **NO Orders** (buy/sell separately).

Actually — our order book is for YES tokens only (buy YES = buy cover, sell YES = underwrite).
So the display should be:

```
Order Book                    [YES]

  BUY ORDERS          |   SELL ORDERS
  (cover buyers)      |   (underwriters)
  ────────────────────|─────────────────
  200 bps  · 5.00     |   150 bps · 10.00
  180 bps  · 3.00     |   175 bps · 8.00
  150 bps  · 7.00     |   200 bps · 5.00
                      |
  Mid price: 175 bps (1.75¢)
```

**Columns:** Price (bps) · Amount (USDC)
**Color:** Buy orders in green-tinted rows, sell orders in red-tinted rows.
**Mid price line** between the two sides — this is the implied probability.

**Data source:** `get_orders()` — returns Map of all open orders.
Sort buys descending by price, sells ascending by price.

---

### RIGHT COLUMN

#### A. Trade Panel
Two tabs: **Buy Cover** | **Underwrite**

**Tab: Buy Cover (Buy YES)**
```
Buy Cover
───────────────────────────────
Amount of cover   [_____ USDC]
                  e.g. enter 100 for $100 of cover

At current price  3.1¢ per $1
You pay (premium) $3.10
You receive       100 YES tokens

If USDC depegs:   +$100.00 USDC
If no depeg:      $0 (premium lost)

Order type: [Market] [Limit]
            Market = fill at best available ask
            Limit = set your own max price (bps)

Limit price: [___] bps   (only shown if Limit selected)

[Buy Cover — Pay $3.10 USDC]
```

**Friendly framing:** "You pay $3.10 to protect $100 of USDC" — not "buy 100 YES tokens at 150 bps."
Hide the YES/NO/bps language in the UI. Show it in the order book only.

**Tab: Underwrite (Sell YES / Mint)**
This is more complex — two steps: Mint → then Sell.
We should make this a guided flow, not two separate actions.

```
Underwrite
───────────────────────────────
Step 1: Deposit USDC
Amount   [_____ USDC]

You deposit $50 USDC and receive:
  50 YES tokens  (to sell as cover)
  50 NO tokens   (you keep these)

Step 2: Set your premium
Sell YES at  [___] bps
             150 bps = 1.5¢ per YES = $0.75 premium on 50 YES

If no depeg by Jul 30:
  You earn: $0.75 premium (kept)
  You reclaim: $50 USDC collateral via NO tokens

If USDC depegs:
  You lose: $50 collateral (pays out to YES holders)
  You keep: $0.75 premium earned

[Mint + Place Sell Order]
```

Single button that does BOTH: mint_complete_set + place_order(sell, price_bps, amount).
This is the key UX improvement over our current implementation where these are separate.

#### B. Your Position (below trade panel)
Only shown if wallet connected and has a position in this market.

```
Your Position
─────────────────────────────────
YES tokens (cover):    10.00
NO tokens (underwriting): 30.00

Current value if YES wins:  $10.00
Current value if NO wins:   $30.00

[Claim Winnings]   ← only shown if market is settled/expired
```

---

## PAGE 3: ANCHOR TRUST

### Purpose
Show the ACR scores for all registered anchors. Frame this as "the trust signal for Stellar's anchor economy."

### Layout
Top: Explanation banner (dismissible)
Middle: Anchor cards
Bottom: "What is ACR?" explainer

### Explanation Banner
```
Anchor Confidence Ratio (ACR) — public on-chain infrastructure

Anchors can stake their own USDC against their stablecoin market.
ACR = staked USDC ÷ total cover outstanding.
A higher ACR means the anchor has more of their own capital at risk alongside users.
Readable by any contract, wallet, or indexer: get_acr(anchor_address)
```

### Anchor Cards
Each anchor gets a card showing:

```
┌───────────────────────────────────────────────────────────┐
│ [MG logo]  MoneyGram                          [BBB]       │
│            GDMXS7S7...                                     │
│                                                            │
│ Market:    USDC Depeg (Market 0)                          │
│ Staked:    $5.00 USDC                                     │
│ Cover out: $29.00 YES tokens                              │
│ ACR:       0.17x                                          │
│                                                            │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  17%                   │
│ [bar fills to 100% at ACR = 2.0x]                         │
│                                                            │
│ "MoneyGram has staked $0.17 for every $1.00 of cover sold"│
└───────────────────────────────────────────────────────────┘
```

**Rating labels and meaning:**
- AAA (≥2.0x): "Anchor has staked 2x the total cover — exceptional confidence"
- AA (≥1.0x): "Anchor has fully backed all cover sold with their own capital"
- A (≥0.5x): "Anchor covers more than half of outstanding risk with their own stake"
- BBB (≥0.1x): "Anchor has partial skin in the game"
- C (<0.1x): "Limited stake relative to cover — low confidence signal"

**If no anchors registered:**
Show empty state: "No anchors have staked yet. ACR infrastructure is live — anchors can register via the contract."
Do NOT hide the page. The infrastructure existing is itself the story.

### "What is ACR?" Explainer (bottom of page)
Simple two-column: concept on left, code snippet on right.

Left:
```
ACR is a single number that tells you how much an anchor
trusts their own product.

When MoneyGram issues MGUSD, they can stake their own USDC
against the MGUSD depeg market. If MGUSD depegs, their stake
is used to pay out cover buyers. If it doesn't, they get
their stake back.

The ACR is that stake divided by the total cover sold.
The higher it is, the more aligned the anchor is with their users.
```

Right (code block):
```rust
// Any Soroban contract can read this:
let acr: i128 = anchor_stake_client.get_acr(&anchor_address);
// 10_000 = 1.0x, 20_000 = 2.0x, 5_000 = 0.5x
```

---

## PAGE 4: PROTOCOL STATS

### Purpose
Transparency and credibility. Shows the protocol is real and has activity.

### Layout
Top row: 4 big stat numbers
Middle: Markets table (all markets, all states)
Bottom: Settlement history + "How settlement works" explainer

### Top Stats (4 cards)
1. **Total Markets** — integer, from `list_markets()`
2. **Total USDC Locked** — sum of `get_total_collateral()` across all open markets
3. **Markets Resolved** — count of Settled + Expired markets
4. **NO Win Rate** — "X% of resolved markets expired without a depeg"

### Markets Table
Columns: ID · Market Name · Covered Asset · Collateral · Oracle Price · Threshold · State · Expiry
- Oracle Price column: live Reflector price for each covered asset
- This lets users see at a glance how close each market is to its threshold
- Threshold column: the $ trigger level (e.g. $0.995)
- "Distance to threshold" could be a computed column: (current_price - threshold) / threshold × 100

### Settlement History
If markets have resolved:
- Show a timeline of settled markets
- "Market 4 (USDC test) — Expired (NO won) — Jul 30 2026 — $20.00 collateral returned"

If no resolved markets (other than market 4):
- Show market 4's resolution as the example
- Add note: "Markets 0-3 expire Sep 28, 2026"

---

## DATA REFRESH STRATEGY

| Data | Refresh interval | Source |
|------|-----------------|--------|
| Oracle price (Reflector) | 30 seconds | `queryContract(oracle, 'lastprice')` |
| Market state (Open/Settled/Expired) | 60 seconds | `queryContract(market, 'get_state')` |
| Order book | 30 seconds | `queryContract(market, 'get_orders')` |
| Collateral | 60 seconds | `queryContract(market, 'get_total_collateral')` |
| ACR scores | 120 seconds | `queryContract(anchor_stake, 'get_all_acr')` |
| User balances | On wallet connect + after tx | `queryContract(market, 'get_balances')` |

**Important:** All reads are simulation calls — no wallet needed, no fees. Only writes need Freighter.

---

## CHARTS NEEDED — LIBRARY DECISIONS

**Recharts is already installed.** Use it for everything. No new chart libraries needed.

| Chart | Type | Component | Data |
|-------|------|-----------|------|
| Risk Curve (overview) | BarChart | Recharts BarChart | YES best-ask per market |
| Oracle price history | LineChart + ReferenceLine | Recharts LineChart | Reflector `prices(asset, 288)` |
| ACR bar | Custom progress bar | Plain div | `get_all_acr()` |
| Stats NO win rate | Custom progress bar | Plain div | Computed from market states |

**No candlestick chart.** Canary shows candlesticks of YES price. We can't reproduce this
without historical trade data (which requires Mercury indexer). Oracle price as a line chart
is more useful anyway — it shows how close to the threshold the real asset is, which is
the actual risk signal. The YES price implied probability is shown as a number, not a chart.

---

## INTERACTION FLOWS

### Flow 1: Buy Cover (simplest, most common)
1. User arrives at Risk Curve page — sees USDC has 0.31% implied probability
2. Clicks "Buy Cover" on USDC card OR navigates to Hedge Markets → USDC market
3. On market detail: sees oracle chart, understands threshold, reads "How this settles"
4. In Trade Panel → "Buy Cover" tab
5. Enters amount: "100" USDC of cover
6. Sees preview: "Pay $3.10 USDC · Receive 100 YES tokens · If depeg: +$100"
7. Clicks "Buy Cover — Pay $3.10 USDC"
8. Freighter opens → user approves
9. Transaction confirmed → "Your Position" panel updates to show 100 YES tokens
10. Watcher auto-matches if a sell order exists at ≤ their bid price

### Flow 2: Underwrite (more complex, yield-focused)
1. User navigates to USDC market
2. Trade Panel → "Underwrite" tab
3. Enters: "50 USDC to deposit" · "150 bps premium"
4. Sees preview: "Mint 50 YES + 50 NO · Sell YES at 1.5¢ · Earn $0.75 if NO wins"
5. Clicks "Mint + Place Sell Order" — single transaction pair (two Freighter prompts)
6. After confirmation: Position shows 50 NO tokens · Orders show sell order at 150 bps

### Flow 3: Claim after settlement
1. Market 4 (expired) — user sees "Expired — NO won" badge on market card
2. "Your Position" shows 20.00 NO tokens
3. Clicks "Claim Winnings"
4. Freighter → approve
5. Receives $20.00 USDC

---

## WALLET STATE BEHAVIOR

- **Not connected:** Can browse all markets, see charts, see ACR. Cannot trade.
  - Show "Connect Wallet to Trade" where buy/underwrite buttons would be.
  - This is intentional — don't gate the information.
- **Connected, wrong network:** Show "Switch to Stellar Testnet in Freighter" warning.
- **Connected, correct network:** Full functionality.

---

## SECTION NAMES FINAL DECISION

| Old name | New name | Rationale |
|----------|----------|-----------|
| Insurance Markets | **Hedge Markets** | Legally cleaner, product-accurate |
| Anchor ACR Scores | **Anchor Trust** | Human, concept-first |
| Protocol Stats | **Protocol Stats** | Fine as-is, clear |
| (new) | **Risk Curve** | The headline view — the market-implied risk surface |

---

## NOTES FOR IMPLEMENTATION

1. **The Risk Curve page is the default route** (`/`) — not the market list. The risk curve IS the product story.
2. **Market detail lives at `/market/[id]`** — each market has its own URL for sharing.
3. **No modal-based trading** — inline trade panels keep context visible. The oracle chart and trade form are always visible together.
4. **The oracle price chart is the most important visual** — it tells the user whether their cover might actually pay out soon. Keep it large, above the fold on the market detail page.
5. **"How this settles" is non-negotiable** — every market detail page must have this section. It builds trust and prevents support questions.
6. **Mobile is secondary** — this is a desktop-first product. Traders don't use mobile. Optimize for 1280px+.
7. **Recharts `prices(asset, records)` gives us 24h oracle history for free** — confirmed from Reflector docs. Use this for the oracle chart. No indexer needed for this specific chart.
