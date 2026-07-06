import type { Resolved } from "../types.js";
import { structuredCall } from "../lib/anthropic.js";
import { tokenSearch, type SearchToken } from "../lib/okx.js";
import { BudgetGuard } from "../pipeline/budget.js";
import { isCliEntry } from "../fixtures.js";

const DEFAULT_CHAIN = "501"; // solana — v1 primary chain

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["token_address", "ticker", "narrative", "scan", "daily", "edge", "smartmoney"],
      description:
        "token_address: a blockchain contract address (base58 or 0x...). ticker: a token symbol or memecoin name (e.g. PEPE, doge, $WIF). narrative: a story, event or theme in plain words (e.g. 'fed rate cut', 'world cup', 'AI agents'). scan: a discovery request over the whole market (e.g. 'scan', 'what's heating up'). daily: today's picks/tips/alpha (e.g. \"today's prediction tip\", \"picks of the day\", \"daily alpha\"). edge: where is the market MISPRICED / where's the value/edge (e.g. \"where's the edge\", \"any mispriced markets\", \"find value\", \"edge radar\"). smartmoney: what smart money / whales are buying (e.g. \"what's smart money buying\", \"whale accumulation\", \"smart money\").",
    },
    cleaned: {
      type: "string",
      description: "The canonical form: address as-is; ticker uppercased without $; narrative lowercased and trimmed.",
    },
  },
  required: ["kind", "cleaned"],
  additionalProperties: false,
} as const;

function firstToken(data: Array<{ tokenInfos?: SearchToken[] } & SearchToken> | null): SearchToken | null {
  if (!data || data.length === 0) return null;
  return data[0].tokenInfos?.[0] ?? data[0];
}

export type ResolvedOrScan =
  | Resolved
  | { type: "scan"; name: string }
  | { type: "daily"; name: string }
  | { type: "edge"; name: string }
  | { type: "smartmoney"; name: string };

export async function resolve(query: string, budget: BudgetGuard): Promise<ResolvedOrScan> {
  const cls = await structuredCall<{ kind: "token_address" | "ticker" | "narrative" | "scan" | "daily" | "edge" | "smartmoney"; cleaned: string }>({
    label: "resolve_classify",
    system:
      "You classify a crypto market query. Classify precisely; do not guess a ticker out of a phrase that reads as a story or event.",
    user: query,
    schema: CLASSIFY_SCHEMA as unknown as Record<string, unknown>,
    budget,
    maxTokens: 200,
    effort: "low",
  });

  if (cls.kind === "scan") {
    return { type: "scan", name: "market scan" };
  }
  if (cls.kind === "daily") {
    return { type: "daily", name: "daily alpha" };
  }
  if (cls.kind === "edge") {
    return { type: "edge", name: "edge radar" };
  }
  if (cls.kind === "smartmoney") {
    return { type: "smartmoney", name: "smart money" };
  }
  if (cls.kind === "narrative") {
    return { type: "narrative", name: cls.cleaned };
  }

  // Canonicalize address/ticker via OKX token search (Trenches-aware).
  const found = firstToken(await tokenSearch(cls.cleaned, DEFAULT_CHAIN, budget));
  if (!found) {
    // Honest fallback: unresolvable ticker reads as a narrative, not invented token data.
    return { type: "narrative", name: cls.cleaned.toLowerCase() };
  }
  return {
    type: "token",
    name: found.tokenSymbol ?? found.symbol ?? cls.cleaned,
    chain: found.chainIndex ?? DEFAULT_CHAIN,
    address: found.tokenContractAddress ?? found.tokenAddress,
  };
}

if (isCliEntry(import.meta.url)) {
  const budget = new BudgetGuard();
  resolve(process.argv[2] ?? "pepe", budget).then((r) => {
    console.log(JSON.stringify(r, null, 2));
    console.log(`cost: $${budget.total().toFixed(5)}`);
  });
}
