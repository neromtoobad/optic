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
