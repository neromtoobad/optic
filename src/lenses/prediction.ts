import type { Lens, PredictionVenue, Resolved } from "../types.js";
import { structuredCall } from "../lib/anthropic.js";
import { cacheKey, cacheGet, cacheSet } from "../db.js";
import { BudgetGuard } from "../pipeline/budget.js";
import { isCliEntry } from "../fixtures.js";

const GAMMA = "https://gamma-api.polymarket.com";
// Phase 0 finding: Gamma fuzzy-matches garbage queries with CLOSED markets.
// Relevance = open + volume floor + keyword hit. A wrong match is worse than null.
const VOLUME_FLOOR = 10_000;

const KEYWORDS_SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: { type: "string" },
      description:
        "0-4 search keywords for finding prediction markets about the OUTCOME this subject's story depends on (e.g. for a Trump memecoin: 'trump'; for a rate-cut narrative: 'fed rate'). Short, concrete, no cashtags. EMPTY ARRAY when the subject is a niche token with no plausible real-world outcome market — a wrong match is worse than none.",
    },
  },
  required: ["keywords"],
  additionalProperties: false,
} as const;

interface GammaEvent {
  title?: string;
  markets?: Array<{
    question?: string;
    slug?: string;
    outcomePrices?: string;
    volumeNum?: number;
    active?: boolean;
    closed?: boolean;
  }>;
}

async function searchGamma(query: string): Promise<GammaEvent[] | null> {
  const key = cacheKey("polymarket:search", query);
  const hit = cacheGet<GammaEvent[]>(key);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`${GAMMA}/public-search?q=${encodeURIComponent(query)}&limit_per_type=8`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { events?: GammaEvent[] };
    const events = json.events ?? [];
    cacheSet(key, events);
    return events;
  } catch (err) {
    console.error(`polymarket search: ${err}`);
    return null;
  }
}

// PREDICTION lens — how outcome markets price the related story (Polymarket
// public read API; free, no auth). Honest null when nothing relevant matches.
export const predictionLens: Lens<PredictionVenue> = {
  name: "prediction",
  async read(resolved: Resolved, budget: BudgetGuard): Promise<PredictionVenue | null> {
    const subject = resolved.type === "token" ? `token ${resolved.name}` : resolved.name;
    const { keywords } = await structuredCall<{ keywords: string[] }>({
      label: "prediction_keywords",
      system:
        "Extract prediction-market search keywords for a crypto subject. Only propose keywords for outcomes a real prediction market would plausibly list (elections, sports, macro, majors like BTC/ETH, big public figures). For a niche memecoin with no real-world event behind it, return an empty list.",
      user: subject,
      schema: KEYWORDS_SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 150,
      effort: "low",
    });

    // Gamma search is literal: narrow phrases surface stale closed markets while
    // broad terms surface live ones. Search the joined phrase AND each keyword,
    // merge, dedupe — the open+volume filter below does the real selection.
    if (keywords.length === 0) return null;

    const queries = [...new Set([keywords.join(" "), ...keywords])].slice(0, 4);
    const results = await Promise.all(queries.map(searchGamma));
    const seen = new Set<string>();
    const events = results
      .filter((r): r is GammaEvent[] => r !== null)
      .flat()
      .filter((e) => {
        const k = e.title ?? "";
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (events.length === 0) return null;

    const terms = keywords.flatMap((k) => k.toLowerCase().split(/\s+/)).filter((t) => t.length > 3);
    const markets = events
      .filter((e) => {
        const hay = (e.title ?? "").toLowerCase();
        return terms.some((t) => hay.includes(t)) || (e.markets ?? []).some((m) => terms.some((t) => (m.question ?? "").toLowerCase().includes(t)));
      })
      .flatMap((e) => e.markets ?? [])
      .filter((m) => m.active && !m.closed && (m.volumeNum ?? 0) >= VOLUME_FLOOR)
      .sort((a, b) => (b.volumeNum ?? 0) - (a.volumeNum ?? 0))
      .slice(0, 4)
      .map((m) => ({
        question: m.question ?? "",
        venue: "polymarket",
        yes_price: Number(JSON.parse(m.outcomePrices ?? "[0]")[0] ?? 0),
        volume: Math.round(m.volumeNum ?? 0),
        url: `https://polymarket.com/market/${m.slug ?? ""}`,
      }));

    return markets.length > 0 ? { markets } : null;
  },
};

if (isCliEntry(import.meta.url)) {
  const budget = new BudgetGuard();
  const q = process.argv[2] ?? "fed rate";
  const out = await predictionLens.read({ type: "narrative", name: q }, budget);
  console.log(JSON.stringify(out, null, 2));
  console.log(`cost: $${budget.total().toFixed(5)}`);
}
