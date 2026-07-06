# Optic AI — 90-second demo script

For the hackathon demo video. Screen-recording + voiceover. Timings are targets, not hard cuts.
Tone: calm, confident, no hype words. Show real calls hitting production, not slides.

---

**[0:00–0:12] The hook**

> "To read one onchain narrative today, you open six tabs — the chart, a prediction market, crypto Twitter, a rug scanner, a smart-money tracker, the news. None of them talk to each other. Optic AI is one agent that reads all of it, and tells you where they disagree."

*(Screen: the six tabs, then collapse into the Optic AI terminal.)*

---

**[0:12–0:35] Demo 1 — the copilot answer**

> "I'll ask it the question everyone's asking this summer — who wins the world cup."

*(Screen: `curl` POST /v1/read "who wins the world cup" hitting the live Railway URL.)*

> "It pulls live betting volume, ranks the favourites — France, Argentina, England — and behind each one, it's done the actual research: squad form, injuries, the draw. Not a volume readout. A researched read, in fifteen seconds."

*(Screen: JSON verdict scrolls — ranked markets + research brief + verdict line. Pause on the verdict_line.)*

---

**[0:35–0:55] Demo 2 — the onchain edge**

> "Now the onchain side. I'll paste a fresh memecoin."

*(Screen: POST /v1/rug with a token address.)*

> "Rug Radar scores it 54 out of 100 — elevated — and shows me why: the dev holds 57% of supply, the top wallets are one funding cluster. That costs five cents, and it settled on X Layer as a real payment."

*(Screen: the risk verdict, then cut to the OKX explorer showing the settled tx hash.)*

---

**[0:55–1:15] The proof**

> "That's the part that matters. Optic AI isn't a demo — it's a registered agent on the OKX marketplace, #4380, with six live services. It takes payment on-chain as a seller, and it pays other agents as a buyer. Every read is a real transaction, and every pick it makes is tracked, publicly, as markets resolve."

*(Screen: the marketplace listing, then PROOF.md scrolling past the tx hashes, then the branded card.)*

---

**[1:15–1:30] The close**

> "Single-domain agents tell you what one market thinks. Optic AI tells you what the whole onchain economy believes — and hands you the picture to share. That's the copilot for onchain markets."

*(Screen: a finished narrative card, OPTIC AI · okx.ai mark. Hold.)*

---

## Shot list / prep

- [ ] Terminal with production URL, font bumped for readability.
- [ ] Pre-warm the two queries (cache) so the demo calls return fast on camera.
- [ ] Have the OKX explorer open on `0xb408ff03…` and the marketplace listing for #4380.
- [ ] Final card exported to `fixtures/cards/demo/` for the hold shot.
- [ ] Record at 1080p minimum; keep the whole thing under 95 seconds.
