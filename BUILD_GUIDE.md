# BUILD_GUIDE.md — OPTIC

## Timeline (real days, no slack theater)
- Jul 6–7 — Phase 0 (admin gaps during SOOTH; SOOTH ships Jul 7)
- Jul 8 — Phase 1: service skeleton (mock lenses), deployed
- Jul 9 — Phase 2: real lenses + divergence engine (GO/NO-GO GATE, see below)
- Jul 10 — Phase 3: card pipeline + Phase 4: x402 payments
- Jul 11 — polish, 5 demo reads end-to-end, listing package
- Jul 12 AM — Phase 5: listing submitted for OKX review [HARD GATE] · PM: Hook x World Cup close
- Jul 13–16 — Phase 6: self-demo cards, launch thread, sales push, form submitted Jul 16
- Jul 17 — buffer only. Nothing ships on deadline day.

## Architecture
```
client (human or agent)
   │ POST /v1/read {query}          x402: 402 → pay → retry
   ▼
Hono server (Railway) ── SQLite (cache · reads · sales)
   │
   ▼ read pipeline (per request, budget-capped)
 [resolve] → what is this query? token addr / ticker / narrative (LLM classify + Trenches lookup)
 [attention] → OKX Social Analytics: vibe timeline, sentiment, mentions, top KOLs   (cached 10m)
 [meme lens] → OKX Trenches + Token/Price: onchain reality, dev flags, similar     (cached 10m)
 [prediction lens] → Polymarket search: related outcome markets + prices           (cached 10m)
 [divergence] → LLM (Anthropic): compare venue reads, score 0–100, one-liner, reasoning (structured JSON, schema-validated)
 [card] → Venice bg + composited stats (parallel with response assembly)
   ▼
 JSON verdict + card_url            GET /v1/card/:id if pending
```

Design rules:
- Lenses are adapters behind one interface: `Lens.read(resolved) → VenueRead | null`. Adding NFT/fan-token lenses later = new adapter, zero engine change. This IS the all-in-one architecture; v1 just ships three adapters.
- Budget guard wraps the pipeline: sum of per-call costs (from Phase 0 price table) checked before each external call; exceeding READ_BUDGET_USD fails the read cleanly (and refund-flags it). Never silently eat margin.
- Cache-first: every external call keyed (endpoint,args) with TTL 600s. Hot narratives → repeat reads nearly free → margin grows exactly when volume spikes.
- Honest nulls: any lens may return null; divergence engine treats absence as signal ("attention is unhedged — no market prices this story"). NEVER invent a venue read.
- No trade language anywhere in output. Lint the verdict strings for banned words (buy/sell/long/short/ape) in tests.
- Card never blocks the verdict: verdict returns ≤60s; card_pending path if Venice is slow.

## Phase 1 — Skeleton (Jul 8)
- Hono server: POST /v1/read (validate: query non-empty ≤200 chars), GET /v1/card/:id, GET /v1/health
- SQLite: reads(id, query, resolved JSON, verdict JSON, card_url, status, paid_tx, cost_usd, created_at) + cache(key, value, expires_at) + a tiny sales view
- Pipeline runner with ALL stages mocked (fixtures from Phase 0)
- x402 middleware stub (PAYMENTS_ENFORCED=false)
- Deployed to Railway at final domain; smoke script (scripts/smoke.sh) passes against live URL
Exit: mock read end-to-end in prod.

## Phase 2 — Real lenses + divergence (Jul 9) ★ GO/NO-GO GATE
Order (riskiest first):
1. resolve — LLM classify (token vs narrative) + Trenches/Token lookup to a canonical subject
2. attention adapter — sentiment metrics + vibe timeline + top KOLs
3. meme adapter — trenches details + price/liquidity + dev flags + similar tokens
4. prediction adapter — Polymarket keyword search from LLM-extracted narrative terms
5. divergence engine — Anthropic call, STRICT JSON schema, retries on invalid, banned-word lint
Run the 5 Phase-0 demo queries end-to-end (JSON only, no card).
GATE (end of Jul 9): do the verdicts read TRUE and INTERESTING to you, a domain native? 
- If yes → proceed.
- If divergence feels thin → fallback A: lead with the ATTENTION-vs-ONCHAIN divergence only (hotness vs price/liquidity — always computable from OKX data alone) and demote prediction matching to "related markets" listing. Still a real product, still cross-venue, ships on schedule.
- This gate is the project's honest heart. Do not rationalize past it.

## Phase 3 — Card pipeline (Jul 10 AM)
- Venice bg generation in locked style + satori/canvas composite (per Phase 0 decision): title, verdict line, 3 venue chips, divergence meter, OPTIC mark, 1200x675
- Card storage on Railway volume, served at /v1/card assets; card generated in parallel; card_pending path tested
- Regenerate the 5 demo verdicts WITH cards. Second eyeball gate: postable? (Cosmetic iteration allowed; structural change is not.)

## Phase 4 — Payments (Jul 10 PM)
- Real x402 exact-scheme seller flow per onchainos-skills dispatcher: unpaid POST → 402 + requirements; paid → verify settlement, store tx hash, run read
- PRICE_USDT=1 from env. One real paid read from a second wallet; tx on X Layer explorer; PROOF.md created (tx, read id, card link)
Exit: real money → real verdict → real card, on-chain provable.

## Phase 5 — Listing (Jul 12 AM) [HARD GATE]
- Category: Finance. Routing description enumerates real buyer phrasings: "is this narrative priced in", "cross-market read on X", "what does the market believe about Y", "meme vs prediction market check", "attention vs price divergence", "narrative card for Z". Study top-seller description patterns first (SoulMirror, SentryX, CoinAnk).
- Listing copy: lead with the one-liner, 1 USDT flat, what a read contains, 3 sample cards embedded, honest limits (3 lenses today; NFT + fan-token lenses on roadmap), explicit "data + analysis, not financial advice."
- api-docs.md: endpoint, schema, 402 flow, one curl walkthrough
- Submit for review; log time; check reviewer feedback DAILY.

## Phase 6 — Campaign (Jul 13–16)
- Self-demo: run OPTIC on the 5 live narratives; post the cards as a thread from the OPTIC account (+ main-account amplification, Base Content Template rules). Every card = ad.
- The signature move: each morning Jul 13–16, post ONE "today's divergence" card on a live narrative. Timely cards on hot narratives are the growth loop — OPTIC's output is inherently newsy.
- DM the 10-builder list: free read on THEIR project's narrative → they post the card → reach compounds.
- Reviews: after each sale, ask for a marketplace review (Revenue Rocket input).
- README + PROOF.md (sales, tx hashes, cards), repo cleanup, 4-slide outline, 90s demo script (screen-record a real read: query → verdict → card → explorer tx).
- Form submitted Jul 16.

## Competitive positioning (from live marketplace scan)
- Nothing on okx.ai reads across venues. SentryX/AlphaCopy/Meme Confluence = meme-only signals. WorldCupCaller/Predict-Raven/ForeGate = prediction-only. SoulMirror proves identity/insight products sell; dealer.exe proves visual-card meta-products sell; CoinAnk proves cheap-call volume works.
- OPTIC = the only cross-venue read + the only Finance agent whose output is a postable visual. Wedge sentence for judges: "every agent here watches one market; OPTIC watches the story move between them."
- Defense in listing copy: we complement single-venue agents (we cite venues, we don't replace them) — avoids picking fights with anointed incumbents.

## Failure modes → designed answers
- Divergence engine produces mush → Jul 9 gate + fallback A (attention-vs-onchain divergence, always computable)
- Market API costs blow budget → cache TTL up, endpoints per read down; price never moves
- Card quality unpostable → Phase 0 gate already decided composite fallback; worst case = clean branded stat graphic
- Polymarket matching misses → honest-null path is a feature ("unhedged attention"), not an error
- OKX review rejects → submitted Jul 12 leaves an iteration cycle; conservative copy (no advice, no earnings claims) minimizes risk
- Venice/API outage mid-campaign → cached reads still serve; card_pending degrades gracefully
