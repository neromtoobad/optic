# Optic AI

**The onchain alpha desk.** One agent that reads memecoins, prediction markets, social attention, and the news behind them as a single connected economy — and does the research, so a 15-second read replaces an hour of tabs.

Built for the OKX.AI Genesis Hackathon. Live on the OKX.AI agent marketplace as **Agent #4380** (X Layer).

> Single-domain agents tell you what one market thinks. Optic AI tells you what the whole onchain economy believes, and where the venues disagree.

---

## What it does

Ask it a real question and it does the research, then answers with a JSON verdict and a shareable card:

- **"who wins the world cup"** → the market's ranked favourites (france 32.8%, argentina 16.7%…) straight from live betting volume, plus the form/injury research behind them.
- **"where's the edge today"** → today's markets ranked by where the price looks soft or rich versus the actual research. Conservative and honest.
- **"what is smart money buying"** → tokens sharp onchain wallets are accumulating right now, by wallet count and volume.
- **paste any token** → a 0-100 rug-safety score with the red flags (dev rug history, holder clusters, LP status).
- **"today's alpha"** → decisive research-backed picks across prediction, meme momentum, and supply risk.

It never fabricates a win rate and never issues a trade instruction. It surfaces the market's read, the research, and where they diverge — and tracks every pick it makes, so the record is real and onchain.

---

## Architecture

```
             client (human or agent)
                     │  POST /v1/<service>  {query}
                     │  x402: 402 → pay 0.05-0.5 USDT on X Layer → retry
                     ▼
        ┌──────────────────────────────────────────┐
        │  Hono server (Railway)                     │
        │  x402 seller middleware (OKX Payment SDK)  │  ── SQLite: cache · reads · sales · picks
        └───────────────┬────────────────────────────┘
                        ▼  resolve (Anthropic classify) → route to mode
   ┌──────────┬──────────┬───────────┬───────────┬───────────┬──────────┐
   │ ATTENTION│  MEME     │ PREDICTION│ RESEARCH  │ RUG RADAR │ SMART $  │
   │ OKX social│OKX trench│ Polymarket│Venice web │OKX cluster│OKX signal│
   │ vibe/KOLs │price/dev │ odds+move │ search    │ +advanced │ feed     │
   └────┬─────┴────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴────┬─────┘
        └──────────┴───────────┴─────┬─────┴───────────┴──────────┘
                                     ▼
                    DIVERGENCE ENGINE / desk synthesis (Anthropic Opus 4.8)
                    score 0-100 · decisive read · cites the numbers + research
                                     ▼
              JSON verdict  +  Venice-backed narrative card (satori/resvg)
                                     ▼
                    track record: every pick logged, scored on Polymarket resolution
```

**One engine, many lenses.** Adding a capability is a new adapter, not a rewrite.

---

## The six services (marketplace)

| Service | Price | Endpoint | What it returns |
|---|---|---|---|
| Cross-venue market read | 0.5 USDT | `POST /v1/read` | full cross-venue read + card for any token/narrative |
| Edge Radar | 0.5 USDT | `POST /v1/edge` | today's mispriced markets, research vs price |
| Daily Alpha | 0.5 USDT | `POST /v1/daily` | decisive research-backed picks of the day |
| Rug Radar | 0.05 USDT | `POST /v1/rug` | token safety score + red flags |
| Smart Money | 0.05 USDT | `POST /v1/smart-money` | tokens sharp wallets are accumulating |
| Narrative Timing | 0.05 USDT | `POST /v1/timing` | early vs late lifecycle for any token |

Free: `GET /v1/health`, `GET /v1/track-record`, `GET /v1/card/:id`.

---

## How to call it (x402)

Every paid route is POST-only; an unpaid POST returns HTTP 402 with payment requirements. The flow:

```bash
# 1. unpaid POST → 402 with a PAYMENT-REQUIRED header (base64 challenge)
curl -i -X POST https://optic-production-5675.up.railway.app/v1/rug \
  -H "Content-Type: application/json" -d '{"query":"<token address>"}'

# 2. sign the challenge with your OKX Agentic Wallet
onchainos payment pay --payload "<PAYMENT-REQUIRED value>"

# 3. replay with the returned header → HTTP 200 + verdict, settled on X Layer
curl -X POST https://optic-production-5675.up.railway.app/v1/rug \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <authorization_header>" \
  -d '{"query":"<token address>"}'
```

Discovery services (`/v1/edge`, `/v1/daily`, `/v1/smart-money`) need no body. See [PROOF.md](PROOF.md) for real settled transactions.

---

## Onchain proof (all on X Layer, chainIndex 196)

- **Identity #4380 registered:** `0x459debf31e582ed3f7246a894c3ca369777b858a4a42d2e5601d6937339e7fa0`
- **First paid read settled:** `0xfa7f00f3810369e5246d645d8d5282c14f6620d9a45655f24d8ef93b465da106`
- **Cheap service settled:** `0xb408ff03df6f70a740e2d2b65fece5b5acb34e1f0369f2ba36296db8d44eb604`
- **Buyer-side (paid Agent 2023):** `0xfd2716c08275c1b1e0735c09314334481d92583de3a20671f971bc7fb18fe3b0`
- **6 services registered:** `0xa8608ea787fe9e6835f257ffb5bc0a46b4bfa81c48dca0ebccc9985c22c3b820`

Optic AI works both sides of the OKX Agent Payments Protocol: as a seller (buyers pay it) and as a buyer (it pays other agents).

---

## Stack

TypeScript · Node 20 · Hono · better-sqlite3 · Railway.
Payments: OKX Agent Payments Protocol / x402 exact scheme (EIP-3009), settled in USDT0 on X Layer.
Data: OKX OnchainOS Market API (Trenches, Social Analytics, Signal, holder-cluster), Polymarket Gamma, Venice web search + image, Anthropic Opus 4.8.
Cards: satori + resvg (no headless browser), Venice-generated backgrounds.

## Run a module standalone

```
npm run edge            # today's mispricing radar
npm run daily           # daily alpha
npm run rug -- <token>  # rug radar
npm run smartmoney      # smart money flow
npx tsx scripts/read.ts "who wins the world cup"
```

Not financial advice. Optic AI reports the map, never a trade instruction.
