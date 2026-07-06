// The verdict schema is the product's spine (CLAUDE.md) — keep stable.

export interface Resolved {
  type: "token" | "narrative";
  name: string;
  chain?: string;
  address?: string;
}

export interface Attention {
  hotness: number | null;
  trend: string;
  mentions_24h: number | null;
  sentiment: { bull: number; bear: number; neutral: number } | null;
  top_kols: Array<{ handle: string; impressions: number | null; followers?: number | null }>;
}

export interface MemeVenue {
  price: number | null;
  chg_24h: number | null;
  liquidity: number | null;
  holders: number | null;
  dev_flags: Record<string, unknown> | null;
  similar_tokens: Array<{ name: string; chain: string; market_cap_usd: number | null }>;
}

export interface PredictionMarket {
  question: string;
  venue: string;
  yes_price: number;
  yes_chg_24h: number | null; // 24h move in the yes-price — odds momentum
  volume: number;
  url: string;
}

export interface UnlockNews {
  title: string;
  summary: string | null;
  importance: string | null;
  source: string | null;
  published_at: string | null;
}

export interface PredictionVenue {
  markets: PredictionMarket[];
}

export interface Divergence {
  score: number; // 0-100
  direction: string;
  one_liner: string;
  reasoning: string[];
}

export interface Research {
  brief: string; // web-researched real-world context (form, injuries, catalysts)
  sources: string[];
}

export interface Verdict {
  query: string;
  resolved: Resolved;
  attention: Attention | null;
  venues: {
    meme: MemeVenue | null;
    prediction: PredictionVenue | null;
    unlock_news: UnlockNews[] | null; // supply-event intelligence from news — factual, never advice
    news: UnlockNews[] | null; // research headlines for narrative subjects (sports, macro, events)
  };
  research: Research | null; // the value-add: web research behind the market read
  divergence: Divergence;
  verdict_line: string;
  generated_at: string;
  card_url: string | null;
  card_pending?: boolean;
}

// SCAN mode — discovery instead of a query-scoped read: where is attention
// accelerating before it's crowded, what's fresh in the trenches, what supply
// events are coming. Same engine, pointed at the whole market.
export interface ScanVerdict {
  query: string;
  resolved: { type: "scan"; name: string };
  scan: {
    rising: Array<{
      symbol: string;
      mentions_1h: number | null;
      mentions_24h: number | null;
      accel_x: number | null; // 1h mention rate vs 24h baseline
      sentiment_label: string | null;
      bullish_ratio: number | null;
    }>;
    fresh_trenches: Array<{
      symbol: string;
      address: string | null;
      market_cap_usd: number | null;
      volume_1h_usd: number | null;
    }>;
    unlock_calendar: UnlockNews[];
  };
  highlights: string[];
  verdict_line: string;
  generated_at: string;
  card_url: string | null;
  card_pending?: boolean;
}

// DAILY ALPHA mode — "what's today's prediction tip". Researches the strongest
// signals across prediction markets + meme momentum + supply events, and returns
// ranked, research-backed picks. Confidence is qualitative (signal strength), never
// a claimed win rate. Every pick cites the numbers behind it.
export interface DailyTip {
  category: "prediction" | "meme_momentum" | "supply_risk";
  headline: string; // the pick, in plain words
  research: string; // the evidence: the concrete numbers behind it
  confidence: "high" | "medium" | "watch"; // strength of the signal, NOT a win-rate
  url?: string;
}

export interface DailyVerdict {
  query: string;
  resolved: { type: "daily"; name: string };
  top_call: { headline: string; reason: string; category: DailyTip["category"] }; // OPTIC's single most decisive call of the day
  tips: DailyTip[];
  research: { brief: string; sources: string[] } | null; // web research behind the top call
  research_note: string; // what was scanned to produce these
  verdict_line: string;
  generated_at: string;
  card_url: string | null;
  card_pending?: boolean;
}

import type { BudgetGuard } from "./pipeline/budget.js";

// Lenses are adapters behind one interface. Any lens may return null —
// absence is signal, never invented data.
export interface Lens<T> {
  name: string;
  read(resolved: Resolved, budget: BudgetGuard): Promise<T | null>;
}
