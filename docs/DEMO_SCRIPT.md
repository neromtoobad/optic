# Optic AI — demo script (~2 min 15s)

Screen-recording + your voice. Simple words all the way through — if a sentence sounds like
a whitepaper, cut it. Timings are targets, not hard cuts.

**Flow: founder quote → the website → the OKX marketplace → a live read → close.**

---

## 0:00–0:15 — The hook (Star Xu's own words)

*(Screen: screenshot of Star Xu's quote — from his X post or the TechCrunch launch story.
Grab it yourself so it's the real visual, not a mockup.)*

> "The founder of OKX said the next decade belongs to one-person companies — because with
> AI agents, one person gets an unlimited workforce. So OKX built a marketplace where
> agents work and get paid, on-chain.
>
> I'm one person. This is my agent. And it's already earning. Let me show you."

*(That's the whole hook. Don't explain more yet — move.)*

## 0:15–0:45 — The website

*(Screen: scroll https://optic-production-5675.up.railway.app slowly — hero, ticker, services.)*

> "This is Optic AI. The idea is simple: every market is people betting on an opinion.
> The crypto chart says one thing. The betting odds say another. Twitter says a third.
>
> When they all agree, the story's already priced in. When they don't — someone knows
> something. Optic reads all of them at once and finds that gap.
>
> Seven things it can do, from five cents a call: check any token or story, daily picks,
> find wrong prices, read stocks, catch rugs, follow smart money, and tell you if a story
> is early or late."

## 0:45–1:10 — The OKX marketplace

*(Screen: https://www.okx.ai/agents/4380 — pause on the stats row, then the review.)*

> "And it's not a demo. It's listed on the OKX.AI marketplace — agent number 4380.
>
> Five-star score. A hundred percent positive. Thirty-nine sold. And this review isn't
> mine — a real user bought a read, got their answer in seconds, and left five stars.
>
> Every one of those sales settled on-chain. You can check every single transaction."

## 1:10–2:00 — A live read (the money shot)

*(Screen: terminal, font big. Pre-warm the query beforehand so the answer is fast on camera.)*

Step 1 — ask:
```
curl -X POST https://optic-production-5675.up.railway.app/v1/rug \
  -H "Content-Type: application/json" -d '{"query":"<token address>"}'
```

> "Here's how it works. I paste a token — any token. The agent says: that'll be five cents.
> That's this 402 message — it's literally asking to be paid."

Step 2 — pay (`onchainos payment pay --payload "..."`) and replay:

> "My wallet pays it — five cents, on-chain, no card, no account, no API key.
>
> And back comes the answer: this token scores 54 out of 100. The developer holds more
> than half the supply. It tells you the risk before you touch it — with the receipts.
>
> And every answer comes with a card you can post anywhere."

*(Screen: open the card URL — hold on the card for 3 seconds.)*

## 2:00–2:15 — Close

*(Screen: back to the site hero, or the LISTED teaser's final frame.)*

> "One person. One agent. Listed, working, and earning on-chain.
>
> Optic AI — agent 4380 on OKX dot AI. The edge was never inside one market.
> It's in the gap between them."

---

## Prep checklist (do these before recording)

- [ ] Screenshot Star Xu's quote (X post or the TechCrunch article headline+quote) — your own capture
- [ ] Open tabs in order: quote image → the website → okx.ai/agents/4380 → terminal → card URL
- [ ] Terminal font ≥ 18pt, dark theme
- [ ] Pre-run the rug query once (cache warm = fast response on camera)
- [ ] Have `onchainos payment pay` ready — the wallet needs ~0.1 USDT on X Layer
- [ ] Record 1080p+, mic close, one take per section is fine — cut between sections

## Companion video (rendered, no voice)

A ~32s motion cut that mirrors this script (quote → site → marketplace → live read → close)
lives at `media-kit/optic-demo.mp4` — use it as the social version of this demo, or as
b-roll inside your recording.
