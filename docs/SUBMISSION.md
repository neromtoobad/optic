# Optic AI — Hackathon submission answers

Pre-filled answers for the OKX.AI Genesis Hackathon form (form deadline **Jul 17, 2026 23:59 UTC**).
Map each block to the matching form field when the form is open. Nothing here is fabricated — every claim traces to [PROOF.md](../PROOF.md).

> ⚠️ The live form fields were never captured (still a TODO in NOTES.md). These are the standard fields such forms ask for. When you open the actual form, confirm field names and paste the matching block.

---

**Project name:** Optic AI

**One-liner (≤120 chars):**
> The onchain alpha desk — one agent that reads memes, prediction markets, and attention as one economy, and does the research.

**Category / track:** Finance Copilot (primary). Also entering: Best Product, Social Buzz, Revenue Rocket.

**Elevator pitch (≤300 chars):**
> Onchain alpha lives in a dozen tabs that don't talk to each other. Optic AI is one agent that reads memecoins, prediction markets, social attention and the news behind them as a single connected economy — does the research, and reports where the venues disagree. Six services, live on-chain, real x402 payments.

**Full description:**
> Single-domain agents tell you what one market thinks. Optic AI tells you what the whole onchain economy believes.
>
> Ask it in plain words — "who wins the world cup", "where's the edge today", or paste a token — and it returns a decisive JSON verdict plus a shareable card in about 15 seconds. One engine (narrative → attention → per-venue read → divergence → verdict) runs through six lenses: attention (OKX Social), meme (OKX Trenches), prediction (Polymarket), research (live web search), rug-safety (OKX holder-cluster), and smart-money (OKX Signal).
>
> It does the actual research — squad form, injuries, news — not just a volume readout, so a 15-second read replaces an hour of tabs. It is honest by construction: never a fabricated win rate, never a "buy this" instruction. It reports the map and tracks every pick on-chain as markets resolve.
>
> Six services are live on the OKX.AI marketplace (Agent #4380), priced 0.05–0.5 USDT, with real x402 settlement on X Layer proven both as a seller and as a buyer of other agents.

**Live endpoint:** https://optic-production-5675.up.railway.app
- `GET /v1/health` (free) · `POST /v1/read` · `POST /v1/edge` · `POST /v1/daily` · `POST /v1/rug` · `POST /v1/smart-money` · `POST /v1/timing`

**Marketplace listing:** OKX.AI Agent **#4380** ("Optic AI")

**Owner wallet:** `0xda30617e4d23810eb948724a4dce0452dfda7e9d`

**On-chain proof (X Layer, chainIndex 196):**
- Identity registered: `0x459debf31e582ed3f7246a894c3ca369777b858a4a42d2e5601d6937339e7fa0`
- 6 services registered: `0xa8608ea787fe9e6835f257ffb5bc0a46b4bfa81c48dca0ebccc9985c22c3b820`
- First paid read (0.5): `0xfa7f00f3810369e5246d645d8d5282c14f6620d9a45655f24d8ef93b465da106`
- Cheap service paid (0.05): `0xb408ff03df6f70a740e2d2b65fece5b5acb34e1f0369f2ba36296db8d44eb604`
- Buyer-side (paid Agent 2023): `0xfd2716c08275c1b1e0735c09314334481d92583de3a20671f971bc7fb18fe3b0`

**Tech stack:** TypeScript · Node 20 · Hono · better-sqlite3 · Railway. Payments via OKX Agent Payments Protocol / x402 (exact/EIP-3009), USDT0 on X Layer. Data: OKX OnchainOS Market API (Trenches, Social, Signal, holder-cluster), Polymarket Gamma, Venice (web search + card image), Anthropic Opus 4.8. Cards rendered with satori + resvg.

**What makes it OKX-native:** built on OKX's own rails end to end — x402 payments, X Layer settlement, OKX Market API as the data spine, and working on both sides of the agent economy (sells its own reads, buys from other agents).

**Compliance note (for review):** Optic AI is a data product, not financial advice. It uses observational language only (priced-in, lagging, diverging, crowded), issues no buy/sell/hold instructions on tokens, and publishes an honest, on-chain-scored track record rather than any success-rate claim.

**Repo:** (add link at submission — README.md + PROOF.md are the entry points.)

**Demo video:** (add link — script in [DEMO_SCRIPT.md](DEMO_SCRIPT.md), 90 seconds.)

---

## Pre-submission checklist

- [ ] OKX marketplace review **approved** (eligibility gate — email to dimejikeji5@gmail.com)
- [ ] Demo video recorded and uploaded (see DEMO_SCRIPT.md)
- [ ] Repo link added above (make public or grant judge access)
- [ ] Confirm real form field names, paste matching blocks
- [ ] At least one real external order (not a self-purchase) for the traction claim
- [ ] Form submitted before Jul 17 23:59 UTC
