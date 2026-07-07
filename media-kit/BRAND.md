# Optic AI — Brand & Media Kit

**The onchain alpha desk.** One agent that reads memecoins, prediction markets, stocks, and social attention as a single connected economy, and reports where the venues diverge.

Live on the OKX.AI marketplace as **Agent #4380** · settles in x402 on **X Layer**.

---

## Logo

- **Primary logo** — [`logo/optic-logo.svg`](logo/optic-logo.svg) · [`.png`](logo/optic-logo.png)
- **Mark only** (the "divergence lens") — [`logo/optic-mark.svg`](logo/optic-mark.svg) · [`.png`](logo/optic-mark.png)
- **Avatar / app icon** (512×512) — [`logo/optic-avatar.svg`](logo/optic-avatar.svg) · [`.png`](logo/optic-avatar.png)

The mark is a lens reading two rays that **diverge from a shared origin** — one market (ink), the other (amber). It is the product in one glyph.

**Usage:** keep clear space of at least the mark's radius on all sides. Minimum wordmark height 24px. Don't recolor the amber, stretch, add shadows, or place the ink logo on a light background (use the dark surface). The amber **I** in "OPTIC AI" is fixed — never remove it.

## Social

- **X / Twitter header** (1500×500) — [`social/optic-x-header.svg`](social/optic-x-header.svg) · [`.png`](social/optic-x-header.png)
- **Card-montage teaser** (~15s, 1280×720 MP4) — [`optic-teaser.mp4`](optic-teaser.mp4) · poster [`optic-teaser-poster.png`](optic-teaser-poster.png). Logo reveal → all 7 cards → outro. Silent, loop-friendly, X-native.

## Card samples

Every paid read emits a shareable card — the card *is* the ad. Full set in [`cards/`](cards): `read` · `edge` · `daily` · `smart` · `rug` · `timing` · `stocks`.

---

## Color

| Token | Hex | Use |
|---|---|---|
| Ink | `#05070d` | background / surface |
| Paper | `#e8ebf2` | primary text, wordmark |
| **Amber** | `#f5a623` | the one accent — the "I", key stat, hero number |
| Muted | `#6d7688` | labels, mono kickers |
| Teal | `#4be3c3` | onchain / positive venue |
| Orange | `#ff8a3d` | prediction / caution |
| Yellow | `#f5c944` | attention / research |
| Danger | `#ff5a5a` | rug "danger" level |

One accent (amber). The venue colors appear only inside cards, never in the logo.

## Typography

- **Space Grotesk** — display, wordmark, titles (weights 500 / 700)
- **IBM Plex Mono** — labels, kickers, stats, the `OKX.AI` mark (weights 400 / 600), letter-spacing 3–6px, uppercase

Fonts live in [`../assets/fonts/`](../assets/fonts).

## Voice

Observational, never advice. Optic reports the map — *priced-in, lagging, diverging, crowded, asleep* — never buy/sell/hold. On social: lowercase, no emojis, no em dashes. Confident but honest; it shows the research and the divergence, and tracks every pick on-chain.

---

## Copy

**One-liner:** Single-domain agents tell you what one market thinks. Optic AI tells you what the whole onchain economy believes — and shows you the picture.

**Taglines:**
- The onchain alpha desk.
- Where the venues disagree is the signal.
- Memecoins, predictions, stocks, attention — one read.

**Boilerplate (short):** Optic AI is an Agent Service Provider on OKX.AI that reads onchain markets as one connected economy — memecoins, prediction markets, tokenized stocks, and social attention — and reports where they diverge. Seven pay-per-call services, settled in x402 on X Layer. Data and analysis, not financial advice.

**Boilerplate (long):** Onchain alpha lives in a dozen tabs that don't talk to each other. Optic AI is one agent that reads memecoins (OKX Trenches), prediction markets (Polymarket), tokenized US stocks (OKX xStocks), and social attention (OKX Social) as a single connected economy, does the web research behind the numbers, and reports where the venues diverge — because disagreement between markets pricing the same story is the signal. It ships seven pay-per-call services from a rug-safety score to a daily research-backed alpha brief, each emitting a shareable card, all settled on-chain via x402 on X Layer. It never fabricates a win rate and never issues a trade instruction; it reports the map and tracks every pick.

---

## Links

- Marketplace: OKX.AI Agent **#4380** ("Optic AI")
- Endpoint: `https://optic-production-5675.up.railway.app`
- On-chain proof: [`../PROOF.md`](../PROOF.md)

## Regenerate

```
npx tsx media-kit/build.ts        # logo, avatar, X header
npx tsx scripts/demo-cards.ts     # the 7 service cards
npx tsx media-kit/teaser.ts       # render teaser frames → /tmp/teaser-frames
ffmpeg -y -framerate 30 -i /tmp/teaser-frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 media-kit/optic-teaser.mp4
python3 media-kit/build-page.py   # the shareable media-kit page
```
