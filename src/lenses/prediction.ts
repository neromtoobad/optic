import type { Lens, PredictionVenue, Resolved } from "../types.js";
import { loadFixture, mockDelay, isCliEntry } from "../fixtures.js";

interface PolymarketFixture {
  events: Array<{
    title: string;
    slug: string;
    markets: Array<{
      question: string;
      slug: string;
      outcomePrices: string; // JSON-encoded array, e.g. '["0.002", "0.998"]'
      volumeNum: number | null;
      active: boolean;
      closed: boolean;
    }>;
  }>;
}

// Relevance rules validated in Phase 0: Polymarket search fuzzy-matches garbage
// queries with CLOSED markets, so open + volume-floor filtering is mandatory.
const VOLUME_FLOOR = 10_000;

// MOCK (Phase 1): serves the saved live fixture from Jul 6 through the same
// filtering the real lens will use. Phase 2: live Gamma public-search with
// LLM-extracted narrative keywords. Honest null when nothing relevant matches.
export const predictionLens: Lens<PredictionVenue> = {
  name: "prediction",
  async read(_resolved: Resolved): Promise<PredictionVenue | null> {
    await mockDelay();
    const fixture = loadFixture<PolymarketFixture>("polymarket_bitcoin");
    const markets = fixture.events
      .flatMap((e) => e.markets)
      .filter((m) => m.active && !m.closed && (m.volumeNum ?? 0) >= VOLUME_FLOOR)
      .sort((a, b) => (b.volumeNum ?? 0) - (a.volumeNum ?? 0))
      .slice(0, 4)
      .map((m) => ({
        question: m.question,
        venue: "polymarket",
        yes_price: Number(JSON.parse(m.outcomePrices ?? "[0]")[0] ?? 0),
        volume: Math.round(m.volumeNum ?? 0),
        url: `https://polymarket.com/market/${m.slug}`,
      }));
    return markets.length > 0 ? { markets } : null;
  },
};

if (isCliEntry(import.meta.url)) {
  const query = process.argv[2] ?? "fed rate";
  predictionLens
    .read({ type: "narrative", name: query })
    .then((r) => console.log(JSON.stringify(r, null, 2)));
}
