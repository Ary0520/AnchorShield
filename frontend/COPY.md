# AnchorShield — Landing Page Copy

> This file contains all text/copy for the landing page.
> It is design-agnostic — layout, colors, and component choices are decided separately.
> Update this file first before touching any UI component.

---

## NAV

- Brand name: **AnchorShield**
- Network badge: **Testnet**
- Nav links: Insurance Markets · Anchor ACR Scores · Protocol Stats
- CTA button: **Connect Wallet**
- Connected state: wallet address (shortened) + "disconnect"

---

## HERO SECTION

### Headline
**Hedge stablecoin risk on Stellar.**

### Subheadline
AnchorShield is a fully on-chain, oracle-driven hedging protocol for stablecoin depegs.
Pay a small premium. Get an automatic payout if the peg breaks. No claims. No humans. No waiting.

### Supporting line (smaller, below subheadline)
$3 billion in tokenized assets now live on Stellar. USDC, EURC, MGUSD, USDT — all with peg risk.
AnchorShield is the first protocol built to price and hedge that risk directly on Soroban.

### Hero CTA buttons
- Primary: **Explore Markets**
- Secondary: **How It Works**

---

## HOW IT WORKS SECTION

### Section heading
**Three steps. Fully automated.**

### Step 1
**Pick a market**
Choose the stablecoin you want to hedge — USDC, EURC, USDT, or MGUSD. Each market
covers a specific depeg event: for example, "USDC drops below $0.995 and stays there for 1 hour."

### Step 2
**Buy cover or underwrite**
- **Cover buyers** pay a small USDC premium and receive YES tokens. If the depeg happens, each YES token redeems for $1 USDC. The premium you pay is also the market's live estimate of how likely the event is.
- **Underwriters** deposit USDC, mint YES + NO tokens, and sell YES to collect the premium. They keep NO tokens. If the peg holds until expiry, they reclaim their full collateral and keep the premium earned.

### Step 3
**Auto-settles on-chain**
The Reflector oracle publishes prices every 5 minutes. Our settlement contract reads it automatically.
No one needs to file a claim. If the breach condition is met, YES wins. If the market expires cleanly, NO wins.
Either way, winning tokens redeem for exactly $1 USDC.

---

## WHY ANCHORSHIELD SECTION

### Section heading
**Built for Stellar's moment.**

### Point 1
**The risk is real and growing**
Stellar now holds over $3 billion in on-chain assets. MGUSD launched June 2026. YLDS launched May 2026.
In February 2026, a single oracle manipulation drained $10M from a Stellar lending pool.
The stablecoins are here. The risk infrastructure isn't — until now.

### Point 2
**Parametric, not indemnity**
Traditional insurance requires proof of loss, claims adjusters, and weeks of waiting.
AnchorShield pays instantly when a machine-verifiable condition is met — a price threshold held for a duration.
The oracle is the judge. The contract is the payout. Nothing else is involved.

### Point 3
**The price IS the signal**
When you buy YES at 150 bps, you're not just buying cover — you're contributing to a market-implied probability.
The YES price across all AnchorShield markets forms a live risk curve for Stellar's stablecoin ecosystem.
Traders, treasuries, and protocols can read this to price stablecoin risk in real time.

### Point 4 — THE DIFFERENTIATOR
**Anchor Confidence Ratio (ACR)**
Anchors like MoneyGram and Bitso can stake their own USDC against their market.
The ratio of their stake to total cover outstanding is published on-chain as a single number: the ACR.
Any wallet, contract, or DeFi protocol on Stellar can call `get_acr(anchor_address)` and know,
in real time, how much skin the anchor has in the game.
This is open financial infrastructure. Not a product feature. Not a dashboard.
A primitive that the entire Stellar ecosystem can build on.

---

## MARKETS SECTION (on landing page — brief intro before CTA to markets page)

### Section heading
**Live markets on Stellar testnet**

### Description
Each market is a fully collateralized, binary outcome contract. One YES token plus one NO token always equals exactly $1 USDC.

### Market list labels (displayed as cards/rows)
- USDC depeg < $0.995 for 1hr · expires Jul 30 2026
- EURC depeg < $0.995 for 1hr · expires Sep 28 2026
- USDT depeg < $0.995 for 1hr · expires Sep 28 2026
- DAI depeg < $0.995 for 1hr · expires Sep 28 2026

### CTA under market list
**View All Markets →**

---

## ACR SECTION (brief intro on landing before CTA to ACR page)

### Section heading
**Anchor Confidence Ratio — the trust layer for Stellar DeFi**

### Description
Anchors stake their own capital against their stablecoin market.
The higher the ratio, the more they've put at risk alongside their users.
Published on-chain. Readable by anyone. No middlemen.

### Sub-copy
`get_acr(anchor_address)` — callable from any Soroban contract, wallet, or indexer.

### CTA
**View Anchor Scores →**

---

## STATS BAR (compact strip, probably just below hero or above footer)

Four numbers, sourced live from contracts:

- **X** Markets live
- **$X** Total USDC collateral locked
- **X** Markets resolved
- **X%** Resolved with no depeg (NO win rate)

---

## FOOTER

### Tagline
AnchorShield — parametric hedging infrastructure for Stellar's stablecoin economy.

### Links
- GitHub (link to repo when public)
- Stellar Testnet
- Soroban Docs

### Legal note
AnchorShield is a decentralized protocol. It is not a licensed insurance product.
All outcomes are determined automatically by on-chain oracle data.
Use at your own risk. Testnet deployment — not for production use.

### Network info
Running on Stellar Testnet · Soroban SDK v26 · Oracle: Reflector Network

---

## TONE NOTES (for whoever writes final copy or refines this)

- **Don't say "prediction market"** — even though the mechanism is the same. The framing is hedging/protection.
- **Do say "hedge"** — it's accurate, legally neutral, and sounds sophisticated.
- **Don't oversell the ACR** — no real anchors have staked yet. Frame it as infrastructure/vision, not "MoneyGram uses AnchorShield."
- **Do reference real numbers** — $3B RWAs, $10M YieldBlox hack, MGUSD June 2026. These are real and credible.
- **Keep it crisp** — the target reader is a DeFi-native user or investor. No need to explain what a blockchain is.
- **The risk curve is the pitch** — AnchorShield markets together form a live implied probability surface for Stellar stablecoin risk. This is genuinely novel. Lead with it in investor conversations.
