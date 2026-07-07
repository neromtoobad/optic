# CLAUDE.md — OPTIC

## What this is
OPTIC is an Agent Service Provider (ASP) on OKX.AI. It is the narrative intelligence layer for onchain markets: one agent that reads memecoins, prediction markets, and social attention as a single connected economy, and reports where the venues DIVERGE — because divergence between markets pricing the same story is the signal.

Input: a token, a ticker, or a narrative in plain words.
Output: a cross-venue read (JSON verdict) + a Venice-rendered "narrative card" (shareable image) showing the story, the venues, and the divergence.

Built for the OKX.AI Genesis Hackathon (form deadline Jul 17, 2026, 23:59 UTC; listing must pass OKX internal review to be eligible). Target awards: Finance Copilot (category), Best Product, Social Buzz (cards), Revenue Rocket (order volume).

## The one-liner for every pitch surface
Single-domain agents tell you what one market thinks. OPTIC tells you what the whole onchain economy believes — and shows you the picture.

## Core engine (never lose this shape)
ONE engine, applied through domain lenses:
narrative → attention → per-venue read → divergence → verdict + card

Lenses are data adapters, not features. v1 ships FOUR lenses + a discovery mode:
1. MEMES — what the token/narrative is doing onchain (OKX Trenches/Token/Price APIs incl. price-info: price, chg_24h, liquidity, holders)
2. PREDICTIONS — how outcome markets price the related story, WITH 24h odds momentum (yes_chg_24h) — this is the sports/events research read (Polymarket public read API)
3. ATTENTION — where the crowd actually is (OKX Social Analytics: vibe/hotness timeline, sentiment, mentions, top KOLs)
4. SUPPLY/NEWS — unlock & vesting intelligence (unlock_news, matched per token) + research headlines for narrative subjects (news), via OKX news search. Factual reporting only; the divergence engine may observe that a venue is/isn't pricing a scheduled supply event — never that anyone should act.
5. RESEARCH — the value-add layer: for event/sports/macro narratives, Venice web search pulls recent real-world context (form, injuries, roster news, weather, catalysts) and the divergence engine synthesises it WITH the market odds. Turns "here are the odds" into "here are the odds + the why + where the research adds nuance". Reuses the Venice key. Anthropic server-side web search was tried and is throttled/unusable on our key (-e.22/failed call) — do not use it.

SCAN mode (query classified as "scan", e.g. "what's heating up"): discovery read over the whole market — 1h-vs-24h mention acceleration ranking (early narrative radar), fresh trenches launches with real volume, and the unlock calendar. Same price, same endpoint, ScanVerdict shape.

DAILY ALPHA mode (query classified as "daily", e.g. "what's today's prediction tip", "picks of the day"): researches the day's strongest signals across three desks — prediction movers (Polymarket trending: highest conviction×volume + biggest 24h odds moves), meme momentum (mention acceleration + fresh launches), supply risk (scheduled unlocks) — and returns ranked, research-backed picks. DailyVerdict shape. CONFIDENCE is signal strength (volume/conviction/corroboration), NEVER a claimed win rate. Honest "accuracy" = thorough research now + a tracked pick record over time (roadmap), never a fabricated percentage. Same price, same endpoint.

Positioning (user-directed, Jul 6): OPTIC sells "the research behind winning picks" — sports odds + movement + news, early narrative detection, supply-event warnings — always as data, never as picks. No success-rate or earnings claims anywhere; that framing is what passes OKX review (the eligibility gate).

NFT and fan-token lenses are ROADMAP, not v1. Do not build them. The product identity is all-in-one from day one because the engine genuinely is one thing; the lenses arrive in order.

## Data sources (verified against docs Jul 6)
OKX OnchainOS Market API (https://web3.okx.com/onchainos/dev-docs/market/market-api-introduction):
- Trenches API (Meme Pump scanner): supported chains/protocols, token list w/ filters, token details, developer info, similar tokens, bundle details, aped wallet details
- Token API + Market Price API: price, liquidity, candles
- Social Analytics API: token sentiment metrics (mention counts, bull/bear ratios, trend series), sentiment ranking by mention volume, Token Vibe Timeline (hotness score + KOL activity + impressions), Top KOLs per token, news search/filter by symbol+sentiment
- Signal API: smart money leaderboard
- NOTE: Market API calls are PAID (see "Market API Fee" + "How to Complete API Payment" docs) — per-call cost is a Phase 0 measurement and part of COGS.

Polymarket public read API (Gamma/CLOB): market search by keyword, prices, volume. Read-only, no wallet needed. Phase 0 sanity-checks endpoints + rate limits.

Venice API: card image generation. Cheap image models; exact model + cost locked in Phase 0 eyeball test.
Anthropic API: narrative synthesis + divergence reasoning (structured JSON out).

## API shape (OPTIC's own service)
- POST /v1/read — x402-gated, 1 USDT flat. Body: { query: string (token address | ticker | narrative), chain?: string }. Response: full JSON verdict + card_url. Target p95 latency ≤ 60s; card generates in parallel with verdict assembly. If card is slow, respond with verdict + card_pending:true and expose GET /v1/card/:job_id (free) — never make the buyer wait on the image.
- GET /v1/health — free.
- Unpaid POST returns HTTP 402 with x402 payment requirements (the Onchain Data Explorer pattern: POST-only paid endpoints, GET on paid routes returns 405).
- x402 LISTING GATE (learned Jul 7, cost 3 rejections). OKX's listing "x402 verification" requires the 402 challenge to match an approved A2MCP agent's shape. The DECISIVE requirement: advertise BOTH schemes — `exact` AND `aggr_deferred` (register `AggrDeferredEvmScheme` alongside `ExactEvmScheme`; the facilitator settles deferred async). Approved agents also carry, inside each accepts entry's `extra`: `symbol:"USDT"`, `transferMethod:"eip3009"`, `name`, `version`, `decimals:6`; and an `https` `resource.url`. We add all of these (see `injectAssetDecimals`/`SETTLEMENT_EXTRA` in [src/payments/x402.ts](src/payments/x402.ts)).
  - Everything extra-token goes ONLY inside `extra`, never the base object: the facilitator matcher deep-equals the base and only checks the server's `extra` keys, so surplus buyer-echoed `extra` keys are ignored but a new base field breaks settlement ("No matching payment requirements").
  - DIAGNOSTIC ORACLE (fast, synchronous): `onchainos agent activate --agent-id <id> --preferred-language en-US` → `data.activate.rejectReason` is the live x402-verification result (null = passing). Also `onchainos agent x402-validate --endpoint <url> --agent-id <id> --job-id 0 --fee-amount <n> --fee-token USDT` returns a `reason`. NOTE: `x402-validate`/`x402-check` GET-probe and report "HTTP 405 not 402" for POST-only endpoints — that's a red herring (approved agents 405 on GET too); trust the `activate` oracle. Buyers' `payment pay` auto-selects `exact`, so real settlement is unaffected by offering `aggr_deferred`.

## Verdict schema (the product's spine — keep stable)
{
  query, resolved: { type: token|narrative, name, chain, address? },
  attention: { hotness, trend, mentions_24h, sentiment: {bull,bear,neutral}, top_kols: [..] },
  venues: {
    meme: { price, chg_24h, liquidity, holders, dev_flags, similar_tokens },
    prediction: { markets: [{question, venue, yes_price, yes_chg_24h, volume, url}] } | null,
    unlock_news: [{title, summary, importance, source, published_at}] | null,
    news: [..same shape, narrative research headlines] | null
  },
  divergence: { score: 0-100, direction, one_liner, reasoning: [..] },
  verdict_line, generated_at, card_url
}
Rules: report the map, NEVER a trade instruction. No "buy/sell/long/short". Language is observational: priced-in, lagging, diverging, crowded, asleep. This is a data product, not financial advice — this keeps OKX review clean and is non-negotiable.

## Pricing + cost control
- 0.5 USDT flat per read (user-set Jul 6; was 1). No tiers. Impulse buy; Revenue Rocket counts orders + reviews.
- COGS budget per read: ≤ 0.30 USDT total (OKX Market API fees + Venice card + Anthropic tokens). Phase 0 measures each; if over, cut API calls per read (cache!) before touching price.
- CACHE aggressively: attention + venue data for a query cached 10 min (SQLite). Repeat queries on hot narratives are nearly free — hot narratives are exactly when call volume spikes.
- MEDIA_BUDGET/APIs: hard per-read spend cap enforced in code; job fails cleanly if a read would exceed it.

## Card design (the marketing engine)
One image per read, 1200x675 (X-native), rendered by Venice from a templated prompt:
- Narrative title + OPTIC verdict line
- Three venue chips (meme / prediction / attention) with the key stat each
- Divergence meter (the hero visual element)
- "OPTIC · okx.ai" mark — the card IS the ad; every posted card carries the name
Style preset locked in Phase 0 (one style, consistent identity — think dealer.exe consistency, not per-card randomness). If pure-Venice text rendering is unreliable (AI text in images often is), fall back to: Venice generates the background art, sharp text/stats composited with satori/canvas in code. Decide in Phase 0 eyeball test; composited is the safer default.

## Stack
- TypeScript, Node 20, Hono, better-sqlite3 (cache + jobs + sales log)
- Hosting: Railway (prior art: SKINS), domain attached
- Payments: OKX Payment SDK / x402 exact scheme per okx/onchainos-skills dispatcher (A2MCP)
- ffmpeg NOT needed (images only, no video)

## Non-negotiables
- git identity configured BEFORE first commit; no AI co-author attribution, ever.
- Small beats ambitious: v1 = one endpoint, one price, three lenses, one card style. No alerts, no subscriptions, no portfolio view, no NFT lens, no execution anything.
- Every module runs standalone via CLI (npm run attention -- pepe, npm run meme -- <address>, npm run predict -- "fed rate", npm run card -- ./fixtures/verdict.json) so failures isolate fast.
- Real on-chain settlement: every paid read is a real x402 tx on X Layer, tx hash stored on the read record, PROOF.md grows with every sale.
- Listing submitted for OKX internal review Jul 12 morning — review approval is an eligibility gate; late submission = invalid entry.
- Never fabricate venue data. A lens that returns nothing reports null honestly; the verdict says "no prediction market is pricing this" — that itself is signal.

## Environment variables
OKX_API_KEY= / OKX_SECRET_KEY= / OKX_PASSPHRASE=   # dev portal creds for Market API
VENICE_API_KEY=            # child key with spend cap
ANTHROPIC_API_KEY=
PRICE_USDT=1
READ_BUDGET_USD=0.30       # hard per-read COGS cap
PAYOUT_ADDRESS=            # X Layer USDT payout
DATABASE_PATH=./data/optic.db
PUBLIC_BASE_URL=
CACHE_TTL_SECONDS=600

## Definition of done per phase (see BUILD_GUIDE.md)
- P1: server + job/read lifecycle with mock lenses, deployed
- P2: three real lenses + divergence engine produce a truthful verdict for 5 test queries
- P3: card renders, consistent style, postable quality
- P4: real x402 payment settles on X Layer, proof recorded
- P5: listing submitted for review (Jul 12 AM)
- P6: self-demo card set, launch thread, sales, form submitted Jul 16

## Key references
- Market API: https://web3.okx.com/onchainos/dev-docs/market/market-api-introduction
- Trenches: .../market/market-scan-chain-api-reference · Social: .../market/market-social-news-reference · Signal: .../market/market-signal-reference
- Market API fees + payment: .../market/market-api-fee and .../market/how-to-finish-api-payment
- ASP payments (our selling side): https://web3.okx.com/onchainos/dev-docs/payments/app + https://github.com/okx/onchainos-skills
- ASP onboarding: https://www.okx.ai/tutorial/asp (JS-rendered — read in browser)
- Marketplace (competitor scan): https://www.okx.ai/agents
