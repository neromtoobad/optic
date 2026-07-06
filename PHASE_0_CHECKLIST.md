# PHASE_0_CHECKLIST.md — OPTIC

Do these before writing code. Admin items fit into SOOTH-crunch gaps (Jul 6–7). [BLOCKER] items must clear before Phase 1 (Jul 8).

## A. Platform access + rules
- [ ] [BLOCKER] Register on okx.ai, start ASP registration. Read https://www.okx.ai/tutorial/asp fully IN A BROWSER (JS-rendered). Screenshot every step. Note: registration + Agentic Wallet setup appear to run through your agent via `npx skills add okx/onchainos-skills` with just an email — confirm.
- [ ] [BLOCKER] OKX Dev Portal credentials (API key/secret/passphrase) for the Market API.
- [ ] Ask in OKX.AI Discord/TG: listing review SLA? Assume 3–5 days; Phase 5 submits Jul 12 AM regardless. Also confirm: multiple listings per builder allowed?
- [ ] Copy every hackathon Google-form field into NOTES.md now.
- [ ] Re-read judging criteria for Finance Copilot + Revenue Rocket; confirm "report the map, not a trade" framing keeps us clear of advice territory in the listing copy.

## B. Market API economics [BLOCKER — this is OPTIC's COGS]
- [ ] Read https://web3.okx.com/onchainos/dev-docs/market/market-api-fee and .../how-to-finish-api-payment. Record: price per call for Trenches, Token/Price, Social Analytics, Signal endpoints; how payment works (x402? prepaid credits?); free tier if any.
- [ ] Make ONE live call to each endpoint OPTIC needs: sentiment metrics, vibe timeline, top KOLs, trenches token details, similar tokens, price. Record exact cost + latency + response shape (save fixtures to /fixtures).
- [ ] Compute worst-case reads-per-verdict (~6–8 calls uncached). Total must fit READ_BUDGET_USD=0.30 alongside Venice + Anthropic. If not: cut endpoints per read or raise cache TTL. Price does not move.

## C. Prediction lens sanity check [BLOCKER]
- [ ] Polymarket public read API: hit the market-search endpoint with 3 keywords (a sports one, a crypto one, a politics one). Confirm: keyword search works, prices + volume returned, no auth wall, rate limits acceptable. Save fixtures.
- [ ] Decide the query→market matching approach for v1: keyword search on narrative terms extracted by the LLM (simple, honest). No embeddings in v1.
- [ ] Confirm honest-null path: a memecoin with no related prediction market must render cleanly ("no outcome market is pricing this narrative — attention is unhedged").

## D. Venice card quality gate [BLOCKER — the DEMORUN lesson: verify output quality BEFORE building]
- [ ] Create Venice child API key with spend cap.
- [ ] Hand-build ONE narrative card from a fixture verdict two ways: (a) pure Venice image with text in-prompt, (b) Venice background + code-composited text/stats (satori or node-canvas). Eyeball both at X size.
- [ ] GATE: would YOU post this card? If neither passes, the card demotes to a simple branded stat-graphic (pure composite, no AI art) and OPTIC remains a data product with a clean visual — decide now, not on day 3.
- [ ] Lock: model, style prompt, composite-vs-pure, cost per card. Record in NOTES.md.

## E. Infrastructure + identity hygiene
- [ ] Railway project; confirm outbound reachability to web3.okx.com, Polymarket API, api.venice.ai, api.anthropic.com (allowlist lesson from SKINS). Attach final subdomain.
- [ ] X Layer wallet for payouts funded/ready; confirm what the ASP selling side needs (from onchainos-skills payment dispatcher docs).
- [ ] Repo `optic` on GitHub. git user.name/email BEFORE first commit. No AI co-author lines. .gitignore: .env, /data, /fixtures/private.
- [ ] Clone okx/onchainos-skills; read the x402 exact-scheme seller flow we must implement.

## F. Campaign prep (cheap now, expensive later)
- [ ] X handle for OPTIC (check @opticonchain / @optic_ai / similar). Profile art in one style with the card design language.
- [ ] Pick 5 LIVE narratives for demo cards (1 sports w/ World Cup market, 1 memecoin with a matching Polymarket market, 1 pure-meme no-market case, 1 majors narrative, 1 wildcard). These become Phase 6 content.
- [ ] Draft launch-thread hook + 10-builder DM list (entrants posting #OKXAI) for cross-promo card reads.

## Exit criteria
Phase 0 done when: ASP registration in progress with review requirements known; Market API called live with costs recorded; Polymarket fixtures saved; card gate passed with locked style; Railway hello-world on final domain; repo initialized with correct identity. Target: end of Jul 7.
