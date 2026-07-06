// The verdict schema is the product's spine (CLAUDE.md) — keep stable.

export interface Resolved {
  type: "token" | "narrative";
  name: string;
  chain?: string;
  address?: string;
}

export interface Attention {
  hotness: number;
  trend: string;
  mentions_24h: number;
  sentiment: { bull: number; bear: number; neutral: number };
  top_kols: Array<{ handle: string; impressions: number }>;
}

export interface MemeVenue {
  price: number;
  chg_24h: number;
  liquidity: number;
  holders: number;
  dev_flags: Record<string, unknown>;
  similar_tokens: Array<{ name: string; chain: string; liquidity: number }>;
}

export interface PredictionMarket {
  question: string;
  venue: string;
  yes_price: number;
  volume: number;
  url: string;
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

export interface Verdict {
  query: string;
  resolved: Resolved;
  attention: Attention | null;
  venues: {
    meme: MemeVenue | null;
    prediction: PredictionVenue | null;
  };
  divergence: Divergence;
  verdict_line: string;
  generated_at: string;
  card_url: string | null;
  card_pending?: boolean;
}

// Lenses are adapters behind one interface. Any lens may return null —
// absence is signal, never invented data.
export interface Lens<T> {
  name: string;
  read(resolved: Resolved): Promise<T | null>;
}
