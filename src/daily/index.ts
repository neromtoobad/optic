import type { DailyVerdict, DailyTip } from "../types.js";
import { trendingMarkets } from "../lib/polymarket.js";
import { sentimentRanking, memeTokenList, num } from "../lib/okx.js";
import { unlockCalendar } from "../lenses/unlocks.js";
import { structuredCall } from "../lib/anthropic.js";
import { lintVerdictStrings } from "../lint.js";
import { BudgetGuard } from "../pipeline/budget.js";
import { isCliEntry } from "../fixtures.js";

const TIPS_SCHEMA = {
  type: "object",
  properties: {
    tips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["prediction", "meme_momentum", "supply_risk"] },
          headline: { type: "string", description: "The pick in plain words, naming the subject and the market's read." },
          research: { type: "string", description: "The evidence: the concrete numbers behind this pick (odds, volume, 24h move, acceleration, unlock size/date)." },
          confidence: {
            type: "string",
            enum: ["high", "medium", "watch"],
            description: "Strength of the SIGNAL (volume + conviction + corroboration), NOT a predicted win rate. high = decisive odds on heavy volume or a large corroborated move; watch = early/thin signal.",
          },
          url: { type: "string", description: "Polymarket URL if the tip is a prediction market; else empty string." },
        },
        required: ["category", "headline", "research", "confidence", "url"],
        additionalProperties: false,
      },
    },
    research_note: { type: "string", description: "One line on what was scanned (counts of markets/tokens/unlocks reviewed)." },
    verdict_line: { type: "string", description: "One shareable headline (<=140 chars) summarising today's strongest call." },
  },
  required: ["tips", "research_note", "verdict_line"],
  additionalProperties: false,
} as const;

const SYSTEM = `You are OPTIC's daily alpha desk. You produce today's research-backed picks from live data across three desks:
- PREDICTION: trending outcome markets with yes-price, 24h odds move, and volume. The market's own probability IS the pick — a decisive favorite on heavy volume is a high-confidence read; a large 24h odds move is where money is flowing.
- MEME MOMENTUM: tokens whose social mention rate is accelerating vs their 24h baseline (early narrative interest) and fresh launches with real volume.
- SUPPLY RISK: scheduled token unlocks/vesting from news — expanding supply is a downside-risk factor to flag.

Produce 4-7 tips, strongest signal first, spread across the desks when the data supports it. Rules:
- Every tip's research field cites concrete numbers from the input. Never invent a number.
- confidence = signal strength (volume, conviction, corroboration), explicitly NOT a predicted win rate. Never claim or imply an accuracy percentage.
- Observational, research framing. A prediction pick states the market's probability ("market favors X at N%"). A supply-risk tip flags the event ("Y unlocks Z% on DATE — supply pressure"). A momentum tip notes the acceleration ("W mentions spiking Nx").
- NEVER give trade instructions. BANNED words: buy, sell, long, short, ape, moon, and action verbs like enter, exit, play, fade, accumulate.
- A thin or empty desk is fine — do not manufacture picks. Better fewer strong tips than filler.`;

/** Daily alpha: research the day's strongest signals into ranked, cited picks. */
export async function runDaily(budget: BudgetGuard): Promise<Omit<DailyVerdict, "card_url" | "card_pending">> {
  const [trending, rank1h, rank24h, fresh, unlocks] = await Promise.all([
    trendingMarkets(40),
    sentimentRanking("1", 20, budget),
    sentimentRanking("3", 20, budget),
    memeTokenList("NEW", 10, budget),
    unlockCalendar(budget),
  ]);

  // Prediction desk: top by conviction*volume (confident calls) + top movers.
  const mkts = trending ?? [];
  const byConviction = [...mkts]
    .filter((m) => m.volume_24h > 100_000 && m.conviction > 0.25)
    .sort((a, b) => b.conviction * b.volume_24h - a.conviction * a.volume_24h)
    .slice(0, 6);
  const byMomentum = [...mkts]
    .filter((m) => m.volume_24h > 100_000 && m.momentum >= 0.05)
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 4);
  const predictionInput = [...new Map([...byConviction, ...byMomentum].map((m) => [m.slug, m])).values()].map((m) => ({
    market: m.question,
    event: m.eventTitle,
    yes_pct: Math.round(m.yes_price * 1000) / 10,
    move_24h_pts: m.chg_24h === null ? null : Math.round(m.chg_24h * 1000) / 10,
    volume_24h_usd: m.volume_24h,
    url: `https://polymarket.com/market/${m.slug}`,
  }));

  // Meme momentum desk: 1h-vs-24h mention acceleration.
  const baseline = new Map<string, number>();
  for (const d of rank24h?.details ?? []) baseline.set(d.tokenSymbol, num(d.mentionCount) ?? 0);
  const rising = (rank1h?.details ?? [])
    .map((d) => {
      const m1h = num(d.mentionCount);
      const m24h = baseline.get(d.tokenSymbol) ?? null;
      const accel = m1h !== null && m24h && m24h > 0 ? Math.round((m1h / (m24h / 24)) * 10) / 10 : null;
      return { symbol: d.tokenSymbol, mentions_1h: m1h, accel_x: accel, sentiment: d.sentiment?.label ?? null };
    })
    .filter((r) => (r.accel_x ?? 0) >= 2)
    .sort((a, b) => (b.accel_x ?? 0) - (a.accel_x ?? 0))
    .slice(0, 6);
  const freshTrenches = (fresh ?? [])
    .map((t) => ({ symbol: t.symbol ?? "?", volume_1h_usd: num(t.market?.volumeUsd1h), market_cap_usd: num(t.market?.marketCapUsd) }))
    .filter((t) => (t.volume_1h_usd ?? 0) > 2_000)
    .slice(0, 4);

  const research = {
    prediction_markets: predictionInput,
    meme_momentum: { rising, fresh_launches: freshTrenches },
    supply_events: unlocks,
    scanned: { markets: mkts.length, rising: rising.length, fresh: freshTrenches.length, unlocks: unlocks.length },
  };

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await structuredCall<{ tips: DailyTip[]; research_note: string; verdict_line: string }>({
      label: attempt === 0 ? "daily_tips" : "daily_tips_retry",
      system: SYSTEM,
      user: JSON.stringify(research) + feedback,
      schema: TIPS_SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 1200,
    });
    const strings = [out.verdict_line, ...out.tips.flatMap((t) => [t.headline, t.research])];
    const lint = lintVerdictStrings(strings);
    if (lint.ok) {
      return {
        query: "daily",
        resolved: { type: "daily", name: "daily alpha" },
        tips: out.tips,
        research_note: out.research_note,
        verdict_line: out.verdict_line,
        generated_at: new Date().toISOString(),
      };
    }
    feedback = `\n\nYour previous output failed the language lint on: ${JSON.stringify(lint.violations.map((v) => v.word))}. Rewrite those without the banned words.`;
  }
  throw new Error("daily tips failed banned-word lint after retry");
}

if (isCliEntry(import.meta.url)) {
  const budget = new BudgetGuard();
  const out = await runDaily(budget);
  console.log(JSON.stringify(out, null, 2));
  console.log(`cost: $${budget.total().toFixed(5)}`);
}
