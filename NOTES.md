# NOTES.md — Phase 0 findings

## Market API economics (measured live Jul 6, 2026)

**Fee model** (from docs, verified working with our key):
- Every API-key holder gets **100,000 free Basic calls + 100,000 free Premium calls per month**
- Post-quota: Basic $0.0001/call, Premium $0.0002/call (x402 pay-per-call, USDT/USDG on X Layer)
- Subscription tiers exist ($99–599/mo) — irrelevant at our volume
- **Conclusion: OKX API COGS ≈ $0 for the entire hackathon window.** A worst-case
  uncached read is ~7 calls; even post-quota that's ~$0.0011. READ_BUDGET_USD is
  effectively all Anthropic + Venice.

## Endpoint inventory (all verified live, fixtures in /fixtures/okx)

| Purpose | Endpoint | Method | Tier | Latency |
|---|---|---|---|---|
| Resolve ticker→address | `/api/v6/dex/market/token/search?search=&chains=` | GET | Basic | ~1.1s |
| Sentiment metrics | `/api/v6/dex/market/social/sentiment/symbol?tokenSymbols=&timeFrame=&trendPoints=` | GET | ? (works) | ~0.5s |
| Vibe/hotness timeline | `/api/v6/dex/market/social/vibe/timeline?chainIndex=&tokenAddress=&timeFrame=` | GET | ? (works) | ~0.7s |
| Top KOLs | `/api/v6/dex/market/social/vibe/top-kols?chainIndex=&tokenAddress=&sortBy=&timeFrame=&limit=` | GET | ? (works) | ~0.6s |
| Trenches token details | `/api/v6/dex/market/memepump/tokenDetails?chainIndex=&tokenContractAddress=` | GET | Premium | ~0.5s |
| Trenches dev info | `/api/v6/dex/market/memepump/tokenDevInfo?chainIndex=&tokenContractAddress=` | GET | Premium | ~0.5s |
| Trenches token list | `/api/v6/dex/market/memepump/tokenList?chainIndex=&protocolId=&rankType=&size=&stage=` | GET | Premium | ~0.5s |
| Similar tokens | `/api/v6/dex/market/memepump/similarToken?chainIndex=&tokenContractAddress=` | GET | Basic | ~0.9s |
| Price | `/api/v6/dex/market/price` | **POST** (array body) | Basic | ~0.4s |

## Auth (implemented in scripts/okx-probe.ts, reuse for src/lib/okx.ts)
Headers: `OK-ACCESS-KEY`, `OK-ACCESS-PASSPHRASE`, `OK-ACCESS-TIMESTAMP` (ISO),
`OK-ACCESS-SIGN` = base64(HMAC-SHA256(timestamp + method + requestPath(+query) + body, secret)).

## Gotchas (cost real debugging time — don't rediscover)
- `.env`: passphrase contains `#` → MUST be quoted or dotenv truncates it (error 50105 "passphrase incorrect")
- token/search params are `search` + `chains` (not `query`/`chainIndex`)
- market/price is POST with a JSON **array** body `[{chainIndex, tokenContractAddress}]`; GET returns code 100
- memepump/tokenList requires `stage` param: NEW | MIGRATING | MIGRATED
- tokenList items use `tokenAddress`; tokenDetails takes `tokenContractAddress` (inconsistent naming)
- tokenDetails on a non-trenches token returns code 0 with `data: null` — this IS the honest-null path
- Social sentiment `timeFrame`: 1=1h 2=4h 3=24h; vibe `timeFrame`: 1=24h 2=72h 3=7d 4=30d (different scales!)

## Live data quality check (Jul 6)
- vibe timeline returns hotness score 0-100 (`score`, `scoreChangeRate`) + engagement/impressions + per-bucket KOLs — exactly the attention lens shape
- top-kols returns real KOLs w/ followers, impressions, first-mention tweet URL
- tokenDetails returns market cap, 1h volume/tx counts, bonding %, holder-tag percentages (top10/dev/insiders/bundlers/snipers/fresh) — dev_flags maps cleanly

## Polymarket (Phase 0-C, done Jul 6)
- `gamma-api.polymarket.com/public-search?q=&limit_per_type=` — no auth, 0.3–1.7s
- Garbage queries fuzzy-match CLOSED markets → lens must filter `active && !closed` + volume floor (implemented)
- Live World Cup 2026 + Fed rate markets confirmed — demo material

## Venice card gate (Phase 0-D, decided Jul 6; style locked after iteration)
- **DECISION: composite approach locked.** Venice background + code-composited text.
  Pure-AI text (ideogram-v4, $0.06) mangled every number ("$$1;62612") and ignored
  the 1200x672 frame — unusable for a stats product. Composite is pixel-sharp.
- **Style LOCKED: "Instrument" (user-approved from 3 variants).** Reticle corner
  marks (lens motif), Space Grotesk headline + IBM Plex Mono data, amber 68/100
  divergence numeral top-right with tick gauge, venue stats as bottom data strip,
  OPTIC brand top-left with amber I. Template: fixtures/cards/card_template.html.
- **Background locked: model `z-image-turbo`, $0.01/card, ~4s.** Prompt: "very dark
  near-black abstract, two thin luminous streams (amber/cyan) splitting apart and
  diverging toward opposite corners, particle trails, deep black negative space,
  film grain, no text" — divergence as the literal visual motif.
- Sample: fixtures/cards/sample_btc100k.png (built from REAL Jul 6 fixture data).
- Phase 3 note: template loads Space Grotesk/IBM Plex Mono from Google Fonts CDN —
  bundle the font files locally for server-side rendering (satori needs them anyway).
- **COGS per read (all measured): OKX ~$0 (free quota) + Venice $0.01 + Anthropic
  (est. $0.02–0.05) ≈ $0.03–0.06 — 5–10x under the $0.30 cap.**

## Card renderer (Phase 3, built Jul 6)
- Production path: Venice z-image-turbo bg + satori (UI layer) + resvg (rasterize), 1200x672 PNG → data/cards/, served at GET /v1/card/:id (immutable cache headers)
- **PERF TRAP: never give satori a large data-URI image — it parsed a 1.3MB PNG for ~85s.**
  Fix: satori renders the UI on a transparent root; the bg <image> + base rect are string-injected
  into the SVG afterward and resvg decodes them natively (~2.5s total composite)
- satori also requires display:flex on EVERY div incl. empty ones (satori-html)
- Fonts bundled in assets/fonts (woff, fontsource CDN): Space Grotesk 500/700, IBM Plex Mono 400/500/600 — glyph coverage is latin-only; no ▸ etc., draw markers as divs
- Venice latency varies 4–30s → response waits max 15s then ships card_pending:true with the
  final URL; render finishes in background and the endpoint serves the PNG when it lands
- Card cost $0.01/read (registered with budget guard); scan cards get their own chip set

## Still open (user-side)
- [ ] ASP registration on okx.ai (listing review SLA question → Discord)
- [ ] Venice card eyeball test (key present; Phase 0-D gate pending)
- [ ] X Layer payout wallet
- [ ] Railway project + domain
- [ ] Hackathon form fields → this file
- [ ] X handle for OPTIC
