# Optic AI — Hackathon submission answers

Pre-filled answers for the OKX.AI Genesis Hackathon form (deadline **Jul 17, 2026 23:59 UTC**).
Map each block to the matching form field. Nothing here is made up — every claim traces to [PROOF.md](../PROOF.md).

---

**Project name:** Optic AI

**One-liner (≤120 chars):**
> One AI agent that checks every market at once — and tells you when they don't agree. That gap is the signal.

**Category / track:** Finance Copilot (primary). Also entering: Best Product, Social Buzz, Revenue Rocket.

**Elevator pitch (≤300 chars):**
> To judge one trade today you need six tabs: the chart, the betting odds, Twitter, a rug checker, the news. Optic AI is one agent that reads all of them at once, does the research, and tells you where they stop agreeing. Ask a question, pay a few cents, get the answer plus a shareable card.

**Full description:**
> Every market is a group of people putting money behind an opinion. The crypto chart says one thing, the betting odds say another, Twitter says a third. When they all agree, the story is already priced in. When they don't — someone knows something. Optic AI finds that gap.
>
> Ask it a plain question — "who wins the World Cup?", "what is smart money buying?", or just paste a token — and in about 15 seconds it returns a clear answer with the reasons, plus a shareable image card. Behind each answer it checks crypto prices (OKX), betting markets (Polymarket), tokenized stocks (OKX xStocks), social buzz (OKX Social), and does live web research: injuries, earnings, news.
>
> It's honest by design. It never invents a win rate and never tells anyone to buy or sell. It shows the numbers, the research, and where the markets disagree — and it logs every prediction it surfaces so its record is public and checkable as markets resolve.
>
> Seven services are live on the OKX.AI marketplace (Agent #4380), from 0.05 to 0.5 USDT per call, every payment settled on-chain via x402 on X Layer. Current listing stats: 5.0 score, 100% positive, 39 sold, with a 5-star review from a real external buyer.

**The seven services (one line each):**
- **Cross-Market Read** (0.5) — any token or story, checked across every market at once
- **Daily Alpha** (0.5) — today's picks with the research behind them
- **Edge Radar** (0.5) — where today's prices look wrong versus the facts
- **Stocks Desk** (0.5) — a stock like NVDA, checked against OKX's tokenized share and analyst views
- **Rug Radar** (0.05) — a 0–100 token safety score with the red flags
- **Smart Money** (0.05) — what sharp wallets are buying right now
- **Narrative Timing** (0.05) — is a token's story early or already over

**Website:** https://optic-ai.xyz (custom domain; same app also serves https://optic-production-5675.up.railway.app)

**Live API:** same origin — `GET /v1/health` (free) · `GET /v1/track-record` (free, the public pick record) · paid: `POST /v1/read` · `/v1/daily` · `/v1/edge` · `/v1/stocks` · `/v1/rug` · `/v1/smart-money` · `/v1/timing`

**Marketplace listing:** https://www.okx.ai/agents/4380 — Agent **#4380** ("Optic AI") · 5.0 ★ · 100% positive · 39 sold (screenshot: [media-kit/proof/okx-listing-2026-07-15.png](../media-kit/proof/okx-listing-2026-07-15.png))

**Owner wallet:** `0xda30617e4d23810eb948724a4dce0452dfda7e9d`

**On-chain proof (X Layer, chainIndex 196):**
- Identity registered: `0x459debf31e582ed3f7246a894c3ca369777b858a4a42d2e5601d6937339e7fa0`
- Services registered: `0xa8608ea787fe9e6835f257ffb5bc0a46b4bfa81c48dca0ebccc9985c22c3b820`
- First paid read (0.5): `0xfa7f00f3810369e5246d645d8d5282c14f6620d9a45655f24d8ef93b465da106`
- Cheap service paid (0.05): `0xb408ff03df6f70a740e2d2b65fece5b5acb34e1f0369f2ba36296db8d44eb604`
- Optic buying from another agent: `0xfd2716c08275c1b1e0735c09314334481d92583de3a20671f971bc7fb18fe3b0`
- Full running record (every milestone with a tx hash): [PROOF.md](../PROOF.md)

**Tech stack:** TypeScript · Node 20 · Hono · better-sqlite3 · Railway. Payments via OKX Agent Payments Protocol / x402 (exact + aggr_deferred, EIP-3009), USDT0 on X Layer. Data: OKX OnchainOS Market API (Trenches, Social, Signal, holder-cluster, xStocks), Polymarket Gamma, Venice (web search + card art), Anthropic Opus 4.8. Cards rendered with satori + resvg.

**Why it's OKX-native:** built on OKX rails end to end — x402 payments, X Layer settlement, OKX Market API as the data source — and it works both sides of the agent economy: it sells its own reads and it has bought from other agents, all on-chain.

**Compliance note (for review):** Optic AI is a data and research product, not financial advice. It never tells anyone to buy or sell, never claims a win rate, and publishes an honest, on-chain-scored record of every prediction it surfaces.

**Repo:** (add link at submission — README.md + PROOF.md are the entry points.)

**Demo video:** (add link — 15s cut ready at media-kit/optic-listed.mp4; 90s script in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).)

---

## Pre-submission checklist

- [x] OKX marketplace review **approved** (Jul 12 — "Listed", public at okx.ai/agents/4380)
- [x] Real external order + 5★ review (Narrative Timing for ETH, buyer "Drained99")
- [x] Website live (served from the API origin, CTAs deep-link to the listing)
- [x] Dated marketplace screenshot in the repo
- [ ] Demo video uploaded (15s cut exists; record the 90s version if time allows)
- [ ] Repo link added above (make public or grant judge access)
- [ ] Confirm real form field names, paste matching blocks
- [ ] Form submitted before Jul 17 23:59 UTC
