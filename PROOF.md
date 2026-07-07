# PROOF.md — OPTIC on-chain record

Grows with every milestone and sale. All on X Layer (chainIndex 196).

## Identity

- **Jul 6, 2026 — ASP identity registered on-chain**
  - Agent ID: **#4380** ("OPTIC")
  - Owner wallet: `0xda30617e4d23810eb948724a4dce0452dfda7e9d`
  - Tx: `0x459debf31e582ed3f7246a894c3ca369777b858a4a42d2e5601d6937339e7fa0`
  - Service: "Cross-venue market read" (A2MCP, 0.5 USDT flat) → https://optic-production-5675.up.railway.app/v1/read
  - Avatar: https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/15f5ea08-9f50-4c1b-a86b-bb91c97fdca9.png
  - Status: registered, NOT yet activated (listing review pending Phase 4 payments)

- **Jul 6, 2026 — identity updated on-chain** (name + descriptions to reflect the full feature set)
  - Name: OPTIC → **Optic AI**
  - Tx: `0x626333f1833a491376685eb34be0de8d5624041e2b9c3a24374b010ce574a743`
  - New description covers: cross-venue reads, edge/mispricing radar, smart-money tracking, rug radar, narrative timing, daily research-backed picks, on-chain-tracked record

- **Jul 6, 2026 — submitted for OKX marketplace review** (activated #4380)
  - approvalStatus moved to under-review; onlineStatus online. Review result within 24h (email + agent window).
  - This starts the eligibility clock (Phase 5 hard gate, ahead of Jul 12).

## Deploy

- **Jul 6, 2026 — production live on Railway**
  - https://optic-production-5675.up.railway.app (health + full read + card serving verified from external network)
  - First production read: pepe, divergence 58, card rendered and served publicly

## Sales

- **Jul 6, 2026 — first real paid read (x402, live on X Layer)**
  - Payment tx: `0xfa7f00f3810369e5246d645d8d5282c14f6620d9a45655f24d8ef93b465da106`
  - Amount: 0.5 USDT0 · payer `0xda30617e4d23810eb948724a4dce0452dfda7e9d` → payout (same wallet, self-test)
  - Scheme: exact (EIP-3009), network eip155:196, settlement status: success (pending async settle)
  - Read: `e96d1c9c-c75e-4f09-a624-4eff70436d5c` — query "bitcoin 100k", divergence 28
  - Verdict: "Polymarket locked onto the $62k-$64k band at 90% (+32.5pts/24h) while social, onchain, and news venues sit silent — venues pricing, attention asleep."
  - Card: https://optic-production-5675.up.railway.app/v1/card/e96d1c9c-c75e-4f09-a624-4eff70436d5c
  - Proves: unpaid POST → 402 (free reject), signed replay → verify → pipeline → settle → verdict + card. The full x402 seller loop works on production.

- **Jul 6, 2026 — expanded to 6 marketplace services** (update #4380)
  - Tx: 0xa8608ea787fe9e6835f257ffb5bc0a46b4bfa81c48dca0ebccc9985c22c3b820
  - Cross-venue read, Edge Radar, Daily Alpha (0.5 USDT each) + Rug Radar, Smart Money, Narrative Timing (0.05 USDT each)
  - Cheap data services (~$0 COGS) priced for order volume; premium services carry the research/LLM value.

- **Jul 6, 2026 — first paid read on a cheap service (Rug Radar, 0.05 USDT)**
  - Payment tx: 0xb408ff03df6f70a740e2d2b65fece5b5acb34e1f0369f2ba36296db8d44eb604 (SUCCESS on X Layer)
  - Service: Rug Radar /v1/rug · query LUZAI token · result: risk 54/100 elevated (dev holds 57%, top-100 own 100%)
  - Proves the full six-service x402 loop settles end to end, including the cheap 0.05 tier.

## Listing review

- **Jul 7, 2026 — listing REJECTED by OKX review, root-caused and fixed**
  - Rejection: "A2MCP service has not been integrated with the OKX Agent Payments Protocol standard."
  - Root cause (found with the reviewer's own tool, `onchainos agent x402-check`): the 402 challenge
    advertised USDT0 (`0x779ded…736`) but carried no `decimals`. OKX's task-system token registry keys
    USDT/USDG by address and does not contain USDT0, so it could not resolve the token's decimals →
    could not compute the human-readable price → rejected as not payment-integrated. `valid` was true
    but `amountHuman` was unresolvable and `tokenResolveError` was set.
  - Fix: inject `decimals: 6` into each accepts entry's **`extra`** (NOT top-level). The facilitator's
    requirement matcher deep-equals the base object and only checks the server's `extra` keys against the
    buyer, so `extra.decimals` satisfies the validator while settlement still matches. A top-level
    `decimals` was tried first and broke settlement ("No matching payment requirements") — do not use it.
  - Verified: `x402-check` now returns `valid:true, amountHuman:0.5` (read) and `0.05` (rug); real 0.05
    settlement still succeeds — tx `0x873a8d94e6f6d80f5da15ad55ed736b97f55e21ebf945e97b1c840c87dd0cbb8`
    (success:true). Fix commit cde0b9e, deployed to production.

- **Jul 7, 2026 — RESUBMITTED for review (fix in place)**
  - Resubmit path: OKX.AI has no web resubmit UI (fully agent-driven); the "Agent conversation interface"
    is the onchainos agent CLI. Working path: `agent update --service '[…operation:update…]'` (re-runs endpoint
    QA on the fixed 402) then `agent activate`.
  - Owner-facing status (`agent get-my-agents`): approvalDisplayStatus 2 — **"Listing under review"**.

- **Jul 7, 2026 — rejected AGAIN (x402 verification), root-caused via a synchronous oracle, fixed**
  - 2nd/3rd rejection: "The Agent has not passed x402 verification. Please re-verify service availability."
    The decimals fix cleared the first (generic) rejection but not this deeper x402 check.
  - Oracle discovered: `agent activate` returns `data.activate.rejectReason` synchronously — the live
    x402-verification verdict. Iterated against it instead of waiting on emails.
  - Compared our 402 challenge to an APPROVED A2MCP agent (Onchain Data Explorer) that settles the SAME
    USDT0 asset. Deltas: it advertises BOTH `exact` + `aggr_deferred` schemes (we had only `exact`); its
    accepts `extra` carries `symbol:"USDT"` + `transferMethod:"eip3009"`; its `resource.url` is https.
  - DECISIVE fix: register `AggrDeferredEvmScheme` and advertise `exact` + `aggr_deferred` (commit 722d3c6).
    After deploy, the activate oracle's `rejectReason` went `"...x402 verification"` → **null**. Also added
    `symbol`/`transferMethod` to extra and forced https resource.url (commits ee57fa7→92c3817).
  - Settlement unaffected — buyers' `payment pay` auto-selects `exact`: verified live, tx
    `0x5437eea57030ebf75c6433fc2e6786e6e841924ba5c37fa09e6a2aba644404ab` (success:true).
  - Status after fix: **"Listing under review"**, x402 verification passing. Awaiting review email.

- **Jul 7, 2026 — added a 7th service: Stocks Desk (OKX tokenized equities)**
  - OKX lists tokenized US equities (xStocks: TSLAx/AAPLx/NVDAx on Solana + Eth). New `/v1/stocks` (0.5 USDT)
    reads the on-chain xStock price alongside Venice equity research (price, earnings, analyst consensus,
    catalysts) + any Polymarket market on the company → cross-venue divergence. Strictly observational
    (consensus reported as attributed data, never buy/sell/hold — securities compliance).
  - Live-tested: NVDA → tokenized NVDAx $194.16 vs research close $195.55, Strong Buy consensus ~$299–309,
    divergence 38 "research ahead of price". Cost $0.033/read. Inherits the x402 dual-scheme fix (valid).
  - Service registration tx: 0x8c4896baecaeed21f9f84cf0365f333f596159ae2b8a6e62d0b9c8e1e33381ec
  - LISTING GATE learned: each `serviceDescription` must be 2 parts on separate lines — ① summary (≤200
    display width) · ② input requirements ("Provide: …", ≤200) — NO disclaimers/links/tech-stack. A too-long
    or disclaimer-laden summary → `[D1] missing sections` / `[D3] summary exceeds …`. Only the changed
    service is re-checked (originals grandfathered). After fix (summary width 189): activate rejectReason null.
  - Status: all **7 services** live, **"Listing under review"**, x402 + description checks passing.

- **Jul 7, 2026 — Stocks Desk shareable card + live paid read**
  - Added a branded card for /v1/stocks: divergence-score hero + three chips (OKX tokenized xStock price,
    reported analyst consensus, prediction/catalyst). Degrades gracefully when a venue is absent.
  - Live paid read settled: tx `0x8a8825f0fc5276673e35bd43f27c656a1a8fd07b2fc50bc672eb71d4379501a1`
    (success:true, 0.5 USDT). TSLA → TSLAx $414.77 (+4.1%), divergence 40, card served (not pending):
    https://optic-production-5675.up.railway.app/v1/card/d7dfe75e-e58a-42c2-872c-4d2d584aba8c
  - Proves the premium stocks service settles and renders a shareable card end-to-end on production.
