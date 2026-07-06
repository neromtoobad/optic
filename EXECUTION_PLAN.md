# EXECUTION_PLAN.md — OPTIC
Prompt-by-prompt plan for Claude Code. Paste in order; one prompt = one session goal. Commit at every ✅. Prereq: Phase 0 complete, repo has all four docs at root, fixtures saved from Phase 0 live calls.

---

## PHASE 1 — SKELETON (Jul 8)

### Prompt 1.1 — Scaffold
```
Read CLAUDE.md and BUILD_GUIDE.md fully before doing anything.

Scaffold OPTIC:
- TypeScript, Node 20, Hono, better-sqlite3
- src/server.ts (routes), src/db.ts (schema: reads, cache, per BUILD_GUIDE), src/pipeline/index.ts (stage runner with per-read budget guard reading READ_BUDGET_USD), src/lenses/{resolve,attention,meme,prediction}.ts and src/engine/divergence.ts and src/card/render.ts — ALL MOCKED for now, each returning the matching fixture from /fixtures with a 500ms delay
- Routes: POST /v1/read (validate query non-empty, ≤200 chars; run pipeline; return verdict JSON + card_url per the schema in CLAUDE.md), GET /v1/card/:id, GET /v1/health
- x402 middleware stub: PAYMENTS_ENFORCED env flag; when true return a placeholder 402 body, when false pass through
- Cache layer in db.ts: get/set with TTL from CACHE_TTL_SECONDS, keyed (endpoint, argsHash)
- Banned-word lint helper (buy, sell, long, short, ape, moon) exported for tests; wire a unit test asserting mock verdicts pass it
- npm scripts: dev, build, start, plus CLI entries per CLAUDE.md non-negotiables (attention, meme, predict, card) that call each module standalone
- .env.example with every var from CLAUDE.md; .gitignore covers .env, /data

Write scripts/smoke.sh (POST a read, print verdict + card_url). Run it locally and show me output.
```
✅ Commit: `phase1: skeleton with mocked lenses`

### Prompt 1.2 — Deploy
```
Prepare for Railway: nixpacks or Dockerfile, PORT from env, DATABASE_PATH on a mounted volume, health check /v1/health. Give me exact dashboard steps (service, volume, env vars, domain attach) as a numbered list. Do not claim completion — I will deploy and paste you the live smoke.sh output to verify.
```
✅ Gate: smoke passes on the live domain. Commit: `phase1: railway deploy`

---

## PHASE 2 — REAL LENSES + DIVERGENCE (Jul 9) ★ GO/NO-GO DAY

### Prompt 2.1 — OKX Market API client + attention & meme lenses
```
Read CLAUDE.md data-sources section. Here are my Phase 0 notes: exact endpoints, auth headers, per-call prices, and saved response fixtures for the OKX Market API.

[PASTE PHASE 0 NOTES + FEE TABLE]

Implement:
- src/lib/okx.ts — authenticated client for the Market API endpoints we use: social sentiment metrics, vibe timeline, top KOLs, trenches token details/list/similar, token price. Every call goes through the cache layer first and registers its cost with the budget guard. Timeouts + typed errors; on failure a lens returns null, never throws through the pipeline.
- src/lenses/attention.ts — real: given resolved subject → { hotness, trend, mentions_24h, sentiment, top_kols } from Social Analytics.
- src/lenses/meme.ts — real: given resolved token → { price, chg_24h, liquidity, holders, dev_flags, similar_tokens } from Trenches + Token/Price.
- src/lenses/resolve.ts — real: classify query via Anthropic (token address / ticker / narrative, strict JSON), then canonicalize tickers/addresses via Trenches lookup.

Test each via its CLI entry against 3 live queries I'll give you; show outputs and the cost the budget guard recorded per read.
```
✅ Commit: `phase2: okx client, attention + meme lenses live`

### Prompt 2.2 — Prediction lens
```
Here are my Phase 0 Polymarket fixtures and endpoint notes: [PASTE].

Implement src/lenses/prediction.ts: extract 2–4 narrative keywords from the resolved subject (Anthropic, strict JSON), search Polymarket's public read API, return top related markets as { question, venue:"polymarket", yes_price, volume, url } — or null when nothing relevant matches (relevance threshold: keyword hit + volume floor; be conservative, a wrong match is worse than a null). Cache like the others. Test via CLI on: a World Cup query, a memecoin with a known related market, and a pure meme with none — the third MUST return null cleanly.
```
✅ Commit: `phase2: prediction lens`

### Prompt 2.3 — Divergence engine + GATE
```
Implement src/engine/divergence.ts per the verdict schema in CLAUDE.md:
- Input: resolved subject + the three lens outputs (any may be null)
- Anthropic call with a strict system prompt: compare what attention says vs what the meme venue prices vs what prediction markets price; produce { score 0-100, direction, one_liner, reasoning[] } + verdict_line. Nulls are signal ("attention is unhedged — no outcome market prices this story"). Observational language only; output must pass the banned-word lint (retry once on failure, then error).
- Score rubric in the prompt: 0–20 aligned, 21–50 mild lag, 51–80 clear divergence, 81–100 extreme disconnect — with the strongest single fact cited in one_liner.
Wire the full pipeline. Run ALL FIVE Phase-0 demo queries end-to-end (no cards). Print the five verdicts and each read's total cost.
```
✅ GATE (me, end of day): verdicts must read TRUE and INTERESTING. If thin → apply fallback A from BUILD_GUIDE (attention-vs-onchain divergence as the lead; prediction becomes "related markets" context). Decide TONIGHT, then:
✅ Commit: `phase2: divergence engine — gate passed [or: fallback A applied]`

---

## PHASE 3 — CARD (Jul 10 AM)

### Prompt 3.1 — Card renderer
```
Phase 0 locked the card approach: [PASTE decision — model, style prompt, pure vs composite, cost].

Implement src/card/render.ts:
- Venice background in the locked style (persist generation id; on retry poll, never resubmit)
- Composite layer (satori or node-canvas): narrative title, verdict_line, three venue chips with key stats, divergence meter, "OPTIC · okx.ai" mark; 1200x675 PNG
- Runs in parallel with verdict assembly; if >45s, verdict returns card_pending:true and GET /v1/card/:id serves it when ready
- Save to the volume; register Venice cost with the budget guard
Regenerate cards for the five demo verdicts. Show me all five.
```
✅ Gate: postable quality (cosmetic iteration OK today only). Commit: `phase3: card pipeline`

---

## PHASE 4 — PAYMENTS (Jul 10 PM)

### Prompt 4.1 — x402 seller flow
```
I've cloned okx/onchainos-skills at [PATH]; creds in .env. Replace the payment stub with the real x402 exact-scheme A2MCP seller flow per the dispatcher reference: unpaid POST /v1/read → 402 with correct payment-requirements (PRICE_USDT from env); paid → verify settlement server-side, store tx hash on the read, run pipeline. GETs stay free. If the SDK contradicts any CLAUDE.md assumption, STOP and tell me — do not improvise payment code.
```
✅ Commit: `phase4: x402 seller flow`

### Prompt 4.2 — Live payment proof
```
I'm paying from a second wallet now. Walk me through the exact client sequence (402 → construct payment → retry). Then verify with me: settlement on X Layer explorer, tx hash on the read row, verdict + card delivered. Create PROOF.md: tx + explorer link, read id, card link, timestamp. This file grows with every sale through Phase 6.
```
✅ Gate: real settlement. Commit: `phase4: live payment proof`

---

## PHASE 5 — LISTING (Jul 12 AM) [HARD GATE]

### Prompt 5.1 — Listing package
```
Write /listing per BUILD_GUIDE Phase 5. I'll paste the top-5 sellers' descriptions first — study the routing patterns, then produce:
- routing-description.txt (<900 chars, trigger phrasings woven into natural prose)
- listing-copy.md (one-liner lead, 1 USDT flat, what a read contains, 3 sample card links, honest limits + roadmap lenses, explicit not-financial-advice line)
- api-docs.md (endpoint, verdict schema, 402 flow, one curl walkthrough)
Writing rules: grounded, short sentences, zero hype, no banned constructions, no earnings claims. This is also OKX review material.
```
✅ Gate: I submit for review myself; time logged in NOTES.md. Commit: `phase5: listing package`

---

## PHASE 6 — CAMPAIGN (Jul 13–16)

### Prompt 6.1 — Launch content
```
Per my Base Content Template rules: (1) OPTIC launch thread, 8–10 posts — post 1 is a real card on a live narrative, then what OPTIC is, the flat price, how to call it, close; (2) three main-account posts, 3 versions each (clean, sharper, more relatable); (3) 12-line DM for the builder list offering a free read on THEIR narrative; (4) the daily "today's divergence" card caption formula for Jul 13–16. All lowercase, no emojis, no em dashes, ➠ for listings, #OKXAI where required.
```

### Prompt 6.2 — Submission wrap
```
Final: README (what OPTIC is, ASCII architecture, how to call, PROOF.md summary), repo cleanup (no mocks in tree, .env.example current), 4-slide markdown outline (problem → the cross-venue read + live card demo → traction: orders/reviews/tx proof → why it wins Finance Copilot), 90s demo script (screen-record: query → verdict → card → explorer tx), every form field from NOTES.md pre-filled. Form goes in Jul 16.
```
✅ Final commits. Form submitted Jul 16.

---

## Stuck protocol (any phase)
```
We are stuck on [X]. Stop coding. Restate: goal, observed behavior, exact error, three ranked likely causes, and the smallest experiment to distinguish them. No fixes until I approve the diagnosis.
```

## Session-start prompt (every new session)
```
Read CLAUDE.md, BUILD_GUIDE.md, PROOF.md, then git log --oneline -15. Tell me: current phase, last gate passed, single next action from EXECUTION_PLAN.md. Wait for my go.
```
