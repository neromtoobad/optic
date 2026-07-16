# Optic AI — demo (~1:49)

**All narration is Nerom's voice. One voice, start to finish. No AI/synthetic voice anywhere.**

The voice track is already generated, verified word-for-word, and sitting in `media-kit/vo/`.
The cold-open b-roll is already generated and graded in `media-kit/coldopen/`.
This document is the **edit sheet**: which audio take plays over which picture.

Nothing here is aspirational — every audio file listed exists. Your job is picture + timing.

---

## The edit

| # | Audio take | Runs | On screen |
|---|---|---|---|
| 1 | `00a_cold.mp3` | 13.1s | Photoreal b-roll: trading floor → orange code → hands on a phone chart → a face lit by a monitor |
| 2 | `00b_thesis_a.mp3` | 7.4s | Star Xu quote card (black/orange) |
| 3 | `00c_thesis_b.mp3` | 2.9s | — hold on the quote |
| 4 | `00d_thesis_c.mp3` | 1.9s | — hold, then dip |
| 5 | `00_turn.mp3` | 4.0s | OPTIC wordmark, orange on black |
| 6 | `01_site_a.mp3` | 9.9s | optic-ai.xyz — hero, slow scroll |
| 7 | `02_site_b.mp3` | 6.3s | keep scrolling — **the OKX data line** |
| 8 | `03_site_c.mp3` | 9.5s | the services grid — a sweep, not a menu |
| 9 | `04_market_a.mp3` | 9.9s | okx.ai/agents/4380 — land on the stats row |
| 10 | `05_market_b.mp3` | 3.0s | the review |
| 11 | `06_live_a.mp3` | 7.4s | copy the **Stocks Desk** prompt → paste into Claude Code |
| 12 | `07_live_b.mp3` | 11.7s | **Claude Code pays. Let it happen on screen.** |
| 13 | `08_live_c.mp3` | 7.3s | the NVDA answer streaming back |
| 14 | `08b_live_d.mp3` | 4.7s | the card — hold on it |
| 15 | `09_close.mp3` | 10.5s | back to the site hero |

`nerom-FULL-narration.mp3` is all fifteen concatenated (1:49) — use it as the reference read,
but cut against the individual takes so you can breathe between beats.

---

## What it says

**Cold open** — *"There are already millions of AI agents. They write your code. They move
your money. But ask any AI agent what a market is really doing… and it's only guessing."*

**Thesis** — *"The founder of OKX saw it first. The next decade belongs to one-person
companies."* / *"One human, an unlimited workforce."* / *"One of them was listening."*

**The turn** — *"Yeah. That was me. So I built the agents their eyes."*

**The site** — *"This is Optic. One market on its own will lie to you. The chart says one
thing, the odds say another. The truth's in the disagreement."* / *"Optic reads them all at
once, straight from **OKX's own market data**, and tells you where they stop agreeing."* /
*"Seven questions. From five cents. Is this token a rug? What's smart money buying? Am I
early to this, or already late?"*

**It's real** — *"And it's not a slide. It's live on OKX's own marketplace. Four days up,
fifty sales, and I wasn't there for a single one."* / *"Another agent gave it five stars."*

**Live (Stocks Desk)** — *"Copy the prompt. Drop it into Claude Code, which is itself an
agent. Watch what it does before it even answers."* / *"It pays. Fifty cents. On its own. No
signup, no card. One agent just paid another. **The payment is the login.**"* / *"I ask it
about NVIDIA. It reads the tokenized share against the real close, and where the analysts
actually sit."* / *"Same story, three different prices. **That's the gap.** And it hands back
a card."*

**Close** — *"One person. One week. Built on OKX's rails. The marketplace sells eyes. I sell
the gap. And right now, while I'm talking to you, it's out there earning."*

---

## Assets that already exist

**Voice** (`media-kit/vo/`) — 15 takes + the combined read. Every take transcript-verified
against the script and ending at −91 dB (no clipped words). `cut.py` is the tool that trims
the throwaway word off each take; keep it if you generate more lines.

**Cold open** (`media-kit/coldopen/`) — four photoreal black/orange clips (`r_v1`–`r_v4`),
the Star Xu quote card (`quote.png`), the OPTIC wordmark (`optic-card.png`), and an SFX kit
(`sfx/`: whoosh, impact, riser, glitch). `build3.sh` assembles them.

`optic-intro3.mp4` is a rendered ~28s intro — **superseded**. It uses a robotized voice you
no longer want. Reuse its *picture*, not its audio.

---

## Direction notes

- **The payment beat is the demo.** When Claude Code fires the fifty cents on its own, stop.
  Let it play. That silence is the only moment a judge sits up.
- **Don't explain the 402.** "One agent just paid another" is the whole explanation.
- **Under-sell the numbers.** "Fifty sales" flat and quick. The number argues for itself.
- **Never say "user."** It's *the agent*, *the caller*, *whoever's got a wallet*.
- **The NVDA line carries no prices on purpose** — the screen supplies the numbers, the VO
  supplies the meaning, so it can't go stale between now and the take.

## Before you record

- [ ] Screenshot Star Xu's real tweet if you want it in place of the quote card
- [ ] Screens in order: b-roll → quote → OPTIC card → optic-ai.xyz → okx.ai/agents/4380
      (Stocks Desk, prompt visible) → Claude Code → the card
- [ ] **Dry-run the paste-and-pay once off-camera** so the payment fires clean on the take.
      Warm the read so the answer streams back fast
- [ ] Wallet funded — Claude Code needs ~1 USDT on X Layer (Stocks Desk is 0.5)
- [ ] **Check the sale count the morning you record.** It was 50 on Jul 16 and moving
- [ ] 1080p+

## Facts checked (Jul 16)

- **Listed Jul 12, 50 sales by Jul 16** → "four days up, fifty sales" is accurate. Re-check
  before recording; if it moved, the number moved.
- **Pricing.** Services run **0.05–0.5 USDT**. Stocks Desk is **0.5** — that's why the live
  beat says *fifty cents*, and why the services line says *"from five cents,"* not "five
  cents each." Those two must stay consistent or the demo contradicts itself on camera.
- **"I sell the gap," not "I sell eyes."** The marketplace already sells eyes — CoinAnk (80
  derivatives APIs), OKX's own Explorer (180 chains), Newsliquid (attention). Each sees a
  *single* market. Cross-venue is the only claim none of them can make.
- **"Another agent gave it five stars"** — the review is from `Drained99`, a real external
  buyer, settled via x402. I could not confirm whether that's an agent or a person operating
  one. Everything on OKX.AI settles agent-to-agent, so it's defensible — but the judges are
  OKX and can see who bought it. Your call.
- **The listing still reads "onchain alpha desk."** It can't be edited without re-triggering
  OKX review, so it stays. Don't read it aloud — speak the site's language, not the listing's.

## Known limit (if you generate more voice lines)

The cloned voice is reliable on **short lines** and degrades on long ones — it corrupted
outright twice (`"1st crankage…"` on repeat) and mangled "OKX" into *"anonymity adorkforce"*
on a long take. Keep every new line to one or two sentences, append a throwaway `"...... Stop."`,
and cut it off with `cut.py`. Always transcribe and check before shipping a take.
