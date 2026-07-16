# Optic AI

**One agent that reads every market at once — and tells you where they stop agreeing.**

Memecoins, prediction markets, tokenized stocks and social attention as a single connected economy. It does the research, so a 15-second read replaces an hour of tabs.

Live on the OKX.AI agent marketplace as **[Agent #4380](https://www.okx.ai/agents/4380)** — **5.0 ★ · 100% positive · 50 sold** *(as of Jul 16, 2026)*. Built for the OKX.AI Genesis Hackathon.

**[optic-ai.xyz](https://optic-ai.xyz)** · **[Agent docs](https://optic-ai.xyz/docs)** · **[Live track record](https://optic-ai.xyz/v1/track-record)**

> The marketplace already sells eyes — chain data, derivatives feeds, news. Every one of them sees a single market. Optic reads across venue *types* and reports the disagreement between them. That gap is the signal.

---

## What it does

Ask it a real question and it does the research, then answers with a JSON verdict and a shareable card:

- **"who wins the world cup"** → the market's ranked favourites straight from live betting volume, plus the form/injury research behind them.
- **"where's the edge today"** → today's markets ranked by where the price looks soft or rich versus the actual research.
- **"what is smart money buying"** → tokens sharp onchain wallets are accumulating right now, by wallet count and volume.
- **"NVDA"** → the OKX tokenized share vs the real close vs where analysts actually sit. Same company, three prices.
- **paste any token** → a 0–100 rug-safety score with the red flags (dev rug history, holder clusters, LP status).
- **"today's alpha"** → decisive research-backed picks across prediction, meme momentum, and supply risk.

It never fabricates a win rate and never issues a trade instruction. Directive language is lint-gated in code before any response leaves the service ([src/lint.ts](src/lint.ts)). Every pick it surfaces is logged and scored when the market resolves on-chain — including when the honest answer is "nothing has resolved yet."

---

## Built for agents

There is no login, no dashboard, no account and no API key. **The payment is the login.** Any agent with a wallet that can settle a few cents of USDT0 on X Layer is a fully authenticated caller. One HTTP call in, structured JSON out, plus a rendered card for when an agent has to explain itself to a human.

---

## Architecture

```
             client (human or agent)
                     │  POST /v1/<service>  {query}
                     │  x402: 402 → pay 0.05–0.5 USDT0 on X Layer → retry
                     ▼
        ┌────────────────────────────────────────────┐
        │  Hono server (Railway)                     │
        │  x402 seller middleware (OKX Payment SDK)  │  ── SQLite: cache · reads · sales · picks
        │  exact + aggr_deferred schemes             │
        └───────────────┬────────────────────────────┘
                        ▼  resolve (Anthropic classify) → route to mode
   ┌──────────┬──────────┬───────────┬──────────┬───────────┬──────────┬─────────┐
   │ ATTENTION│  MEME    │ PREDICTION│ RESEARCH │ RUG RADAR │ SMART $  │ STOCKS  │
   │OKX social│OKX trench│ Polymarket│Venice web│OKX cluster│OKX signal│OKX      │
   │ vibe/KOLs│price/dev │ odds+move │ search   │ +advanced │ feed     │ xStocks │
   └────┬─────┴────┬─────┴─────┬─────┴────┬─────┴─────┬─────┴────┬─────┴────┬────┘
        └──────────┴───────────┴────┬─────┴───────────┴──────────┴──────────┘
                                    ▼
                    DIVERGENCE ENGINE / desk synthesis (Anthropic)
                    score 0–100 · decisive read · cites the numbers + research
                                    ▼
              JSON verdict  +  Venice-backed narrative card (satori/resvg)
                                    ▼
                    track record: every pick logged, scored on resolution
```

**One engine, many lenses.** Adding a capability is a new adapter, not a rewrite. A lens with no data returns `null` — never invented.

---

## The seven services

| Service | Price | Endpoint | What it returns |
|---|---|---|---|
| Cross-Venue Market Read | 0.5 USDT | `POST /v1/read` | full cross-venue read + card for any token/narrative |
| Daily Alpha | 0.5 USDT | `POST /v1/daily` | decisive research-backed picks of the day |
| Edge Radar | 0.5 USDT | `POST /v1/edge` | today's mispriced markets, research vs price |
| Stocks Desk | 0.5 USDT | `POST /v1/stocks` | OKX tokenized share vs real close vs analyst consensus |
| Rug Radar | 0.05 USDT | `POST /v1/rug` | token safety score + red flags |
| Smart Money | 0.05 USDT | `POST /v1/smart-money` | tokens sharp wallets are accumulating |
| Narrative Timing | 0.05 USDT | `POST /v1/timing` | early vs late lifecycle for any token |

Free: `GET /v1/health` · `GET /v1/track-record` · `GET /v1/card/:id`

Query-scoped services (`read`, `rug`, `timing`, `stocks`) take `{"query":"…"}`. Discovery services (`daily`, `edge`, `smart-money`) need no body.

Full reference: **[optic-ai.xyz/docs](https://optic-ai.xyz/docs)**

---

## How to call it (x402)

Every paid route is POST-only; an unpaid POST returns HTTP 402 with the challenge in the `payment-required` header. A `GET` on a paid route returns 405 — expected, and matches the approved OKX A2MCP pattern.

```bash
# 1. unpaid POST → 402 with a base64 payment-required challenge
curl -i -X POST https://optic-ai.xyz/v1/rug \
  -H "Content-Type: application/json" -d '{"query":"<token address>"}'

# 2. sign the challenge with your OKX Agentic Wallet
onchainos payment pay --payload "<payment-required value>"

# 3. replay with the returned header → HTTP 200 + verdict, settled on X Layer
curl -X POST https://optic-ai.xyz/v1/rug \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <authorization_header>" \
  -d '{"query":"<token address>"}'
```

Optic advertises **both** `exact` and `aggr_deferred` schemes on every paid route (buyers auto-select `exact`; the facilitator settles deferred asynchronously). Settlement is USDT0 `0x779ded…713736` on X Layer (`eip155:196`, 6 decimals, EIP-3009).

See [PROOF.md](PROOF.md) for real settled transactions.

---

## Onchain proof (X Layer, chainIndex 196)

- **Identity #4380 registered:** `0x459debf31e582ed3f7246a894c3ca369777b858a4a42d2e5601d6937339e7fa0`
- **Services registered:** `0xa8608ea787fe9e6835f257ffb5bc0a46b4bfa81c48dca0ebccc9985c22c3b820`
- **First paid read settled (0.5):** `0xfa7f00f3810369e5246d645d8d5282c14f6620d9a45655f24d8ef93b465da106`
- **Cheap service settled (0.05):** `0xb408ff03df6f70a740e2d2b65fece5b5acb34e1f0369f2ba36296db8d44eb604`
- **Buyer-side (Optic paid Agent 2023):** `0xfd2716c08275c1b1e0735c09314334481d92583de3a20671f971bc7fb18fe3b0`

Optic works both sides of the OKX Agent Payments Protocol: as a seller (buyers pay it) and as a buyer (it pays other agents). Almost nothing else in the marketplace can show the buyer side.

---

## Stack

TypeScript · Node 20 · Hono · better-sqlite3 · Railway.
Payments: OKX Agent Payments Protocol / x402 (`exact` + `aggr_deferred`, EIP-3009), settled in USDT0 on X Layer.
Data: OKX OnchainOS Market API (Trenches, Social Analytics, Signal, holder-cluster, xStocks), Polymarket Gamma, Venice web search + image, Anthropic.
Cards: satori + resvg (no headless browser), Venice-generated backgrounds.

## Run a module standalone

Every lens runs on its own, so failures isolate fast.

```bash
npm run edge              # today's mispricing radar
npm run daily             # daily alpha
npm run risk -- <token>   # rug radar
npm run timing -- <token> # narrative timing
npm run smartmoney        # smart money flow
npm run stocks -- NVDA    # stocks desk
npm run scan              # what's heating up
npx tsx scripts/read.ts "who wins the world cup"
```

Setup: copy `.env.example` → `.env` and fill in the keys (OKX dev portal, Venice, Anthropic). `npm run dev` to serve locally, `npm test` to run the suite.

---

Not financial advice. Optic AI reports the map, never a trade instruction.
