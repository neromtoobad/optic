import type { PredictionVenue, StockRead, StockVerdict } from "../types.js";
import { structuredCall } from "../lib/anthropic.js";
import { tokenSearch, priceInfo, type SearchToken } from "../lib/okx.js";
import { researchStock, type ResearchBrief } from "./research.js";
import { predictionLens } from "./prediction.js";
import { BudgetGuard } from "../pipeline/budget.js";
import { isCliEntry } from "../fixtures.js";

// STOCKS lens — OKX now lists tokenized US equities (xStocks: TSLAx, AAPLx, NVDAx…)
// on Solana and Ethereum. This reads a company across venues: the OKX-native
// tokenized share price, real-world equity research (price, earnings, the analyst
// consensus), and any prediction market on the company, then reports where they
// diverge. Data and analysis only — a stock is a security, so the language stays
// strictly observational (never buy/sell/hold, never a price target as advice).

const XSTOCK_CHAINS = "501,1"; // solana + ethereum — xStocks live on both

function n(v: unknown): number | null {
  const x = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
}

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    ticker: { type: "string", description: "The US-listed stock ticker in CAPS, no $ (e.g. TSLA, AAPL, NVDA). Infer from a company name if needed." },
    company: { type: "string", description: "The company name (e.g. Tesla, Apple, NVIDIA)." },
    is_stock: { type: "boolean", description: "true only if the query is about a publicly-traded company/stock; false otherwise." },
  },
  required: ["ticker", "company", "is_stock"],
  additionalProperties: false,
} as const;

const SYNTH_SCHEMA = {
  type: "object",
  properties: {
    market_snapshot: { type: "string", description: "One line: the reported real-world share price and recent move, taken from the research. Empty string if unknown." },
    analyst_consensus: { type: "string", description: "One line: the reported sell-side consensus rating and average price target, attributed as data (e.g. 'Consensus Buy, avg target $290 (per research)'). Empty string if unknown. NEVER phrase as your own recommendation." },
    catalysts: { type: "array", items: { type: "string" }, description: "0-4 concrete upcoming/recent catalysts (next earnings date, guidance, product launch, macro event)." },
    divergence: {
      type: "object",
      properties: {
        score: { type: "number", description: "0-100: how much the venues disagree about the company's outlook." },
        direction: { type: "string", description: "Short tag, e.g. 'onchain lagging', 'in agreement', 'research ahead of price'." },
        one_liner: { type: "string", description: "One observational sentence naming the divergence." },
        reasoning: { type: "array", items: { type: "string" }, description: "2-4 observational bullets citing the numbers/venues." },
      },
      required: ["score", "direction", "one_liner", "reasoning"],
      additionalProperties: false,
    },
    verdict_line: { type: "string", description: "One observational sentence: the cross-venue read on this company. Where do the OKX tokenized price, the equity research, and any prediction market agree or diverge?" },
  },
  required: ["market_snapshot", "analyst_consensus", "catalysts", "divergence", "verdict_line"],
  additionalProperties: false,
} as const;

const SYNTH_SYSTEM =
  "You are OPTIC's stocks desk. You read one company across venues: OKX's on-chain tokenized share (xStock) price, real-world equity research, and any prediction market on the company. Report the MAP — where the venues AGREE and where they DIVERGE about the same company. " +
  "This is a DATA product, NOT financial advice. NEVER say buy, sell, hold, long, short, or tell anyone what to do. You may REPORT the sell-side analyst consensus and price target as attributed data, but never issue or endorse a target yourself. Language is observational only: priced-in, lagging, diverging, crowded, catalyst-ahead. " +
  "Divergence score 0-100 = how much the venues disagree about the company's outlook. If a venue is missing, that absence is itself signal (e.g. 'no prediction market is pricing this'). Use only the facts provided; do not invent prices or numbers.";

/** Find the OKX-listed xStock for a ticker and pull its on-chain price. */
async function findXStock(ticker: string, budget: BudgetGuard): Promise<StockRead["tokenized"]> {
  const results = await tokenSearch(`${ticker}x`, XSTOCK_CHAINS, budget);
  const flat: SearchToken[] = [];
  for (const r of results ?? []) {
    if (r.tokenInfos) flat.push(...r.tokenInfos);
    else flat.push(r);
  }
  const want = `${ticker}x`.toUpperCase();
  const sym = (t: SearchToken) => (t.tokenSymbol ?? t.symbol ?? "").toUpperCase();
  const name = (t: SearchToken) => String((t as { tokenName?: unknown }).tokenName ?? "");
  // Prefer an exact {TICKER}x symbol; fall back to anything tagged an xStock.
  const match = flat.find((t) => sym(t) === want) ?? flat.find((t) => /xstock/i.test(name(t)) && sym(t).startsWith(ticker.toUpperCase()));
  if (!match) return null;
  const chain = match.chainIndex ?? "501";
  const addr = match.tokenContractAddress ?? match.tokenAddress;
  if (!addr) return null;
  const pi = (await priceInfo(chain, addr, budget).catch(() => null))?.[0];
  return {
    symbol: match.tokenSymbol ?? match.symbol ?? want,
    chain,
    address: addr,
    price: n(pi?.price),
    chg_24h: n(pi?.priceChange24H),
    liquidity: n(pi?.liquidity),
    holders: n(pi?.holders),
  };
}

export async function stockRead(query: string, budget: BudgetGuard): Promise<StockVerdict> {
  const now = () => new Date().toISOString();

  const ex = await structuredCall<{ ticker: string; company: string; is_stock: boolean }>({
    label: "stock_extract",
    system: "Identify the publicly-traded company a query refers to. If it is not about a stock, set is_stock=false.",
    user: query,
    schema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
    budget,
    maxTokens: 120,
    effort: "low",
  });

  if (!ex.is_stock || !ex.ticker.trim()) {
    return {
      query,
      resolved: { type: "stock", name: query },
      stock: null,
      prediction: null,
      research: null,
      verdict_line: `"${query}" doesn't resolve to a stock — try a ticker or company (e.g. TSLA, NVIDIA, Apple).`,
      generated_at: now(),
      card_url: null,
    };
  }

  const ticker = ex.ticker.toUpperCase().replace(/[^A-Z.]/g, "");
  const company = ex.company.trim() || ticker;

  const [tokenized, research, prediction] = await Promise.all([
    findXStock(ticker, budget).catch(() => null),
    researchStock(`${ticker} ${company} stock`, budget).catch((): ResearchBrief | null => null),
    predictionLens.read({ type: "narrative", name: company }, budget).catch((): PredictionVenue | null => null),
  ]);

  // Nothing sourced anywhere — report the gap honestly rather than invent a read.
  if (!tokenized && !research && !(prediction?.markets?.length)) {
    return {
      query,
      resolved: { type: "stock", name: company },
      stock: null,
      prediction: null,
      research: null,
      verdict_line: `${ticker}: no OKX tokenized share, prediction market, or fresh research surfaced right now — nothing to read across venues.`,
      generated_at: now(),
      card_url: null,
    };
  }

  const synth = await structuredCall<{
    market_snapshot: string;
    analyst_consensus: string;
    catalysts: string[];
    divergence: StockRead["divergence"];
    verdict_line: string;
  }>({
    label: "stock_synth",
    system: SYNTH_SYSTEM,
    user: JSON.stringify({
      ticker,
      company,
      okx_tokenized_xstock: tokenized,
      equity_research: research?.brief ?? null,
      prediction_markets: (prediction?.markets ?? []).slice(0, 5).map((m) => ({ q: m.question, yes: m.yes_price, chg24h: m.yes_chg_24h, vol: m.volume })),
    }),
    schema: SYNTH_SCHEMA as unknown as Record<string, unknown>,
    budget,
    maxTokens: 900,
    effort: "medium",
  });

  const stock: StockRead = {
    ticker,
    company,
    tokenized,
    market_snapshot: synth.market_snapshot || null,
    analyst_consensus: synth.analyst_consensus || null,
    catalysts: synth.catalysts ?? [],
    divergence: synth.divergence,
  };

  return {
    query,
    resolved: { type: "stock", name: company },
    stock,
    prediction: prediction?.markets?.length ? prediction : null,
    research: research ? { brief: research.brief, sources: research.sources } : null,
    verdict_line: synth.verdict_line,
    generated_at: now(),
    card_url: null,
  };
}

if (isCliEntry(import.meta.url)) {
  const budget = new BudgetGuard();
  stockRead(process.argv.slice(2).join(" ") || "TSLA", budget).then((v) => {
    console.log(JSON.stringify(v, null, 2));
    console.log(`cost: $${budget.total().toFixed(4)}`);
  });
}
