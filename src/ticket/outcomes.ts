// TICKET DESK · OKX OUTCOMES adapter (X Layer native).
//
// Replaces the Polymarket CLOB venue. OKX shipped Exchange OS on X Layer with a
// native prediction market ("Outcomes"): YES/NO event contracts settled ON X LAYER,
// authenticated with the SAME OK-ACCESS keys Optic already holds. No cross-chain,
// no proxy-factory onboarding — research → conviction → a YES buy on OKX's own venue.
//
// Object model (OKX docs, docs-v5/outcomes_en):
//   Event  → a real-world event (e.g. "Germany vs. Curacao")
//   Market → a tradable question under it ("Will Germany win?")
//   Outcome→ YES / NO, each with its own `assetId` and a price in [0,1] (≈ probability)
// You trade the `assetId`, never the Event/Market. Base asset is `xp` (X-Layer Points):
// campaign-distributed, settled on X Layer — real on-chain, points-denominated.
//
// The custody rule is UNCHANGED from the Polymarket build: Optic resolves the market,
// reads the live book, and drafts the signable order. It never chooses, never advises,
// never signs, never submits, never touches a key. The EIP-712 write signature stays
// with the buyer (see order side below).
import { createHmac } from "node:crypto";
import { config } from "../config.js";
import { cacheKey, cacheGet, cacheSet } from "../db.js";

// ── endpoint surface ─────────────────────────────────────────────────────────
// Outcomes lives on the main OKX REST host (NOT web3.okx.com/onchainos which the
// Market-API lenses use). Paths below follow the docs-v5/outcomes_en REST section;
// PIN each against the live doc + official SDK in the deploy env (okx.com is
// firewalled from the build sandbox) — run `npx tsx scripts/outcomes-probe.ts` there,
// which reports the working paths + real field names. Grouped here so a fix is one edit.
const BASE = "https://www.okx.com";
const PATHS = {
  events: "/api/v5/outcomes/public/events", // GET  ?state=active  → [{ eventId, title, markets:[...] }]
  market: "/api/v5/outcomes/public/market", // GET  ?marketId=     → { marketId, question, outcomes:[{assetId,side,px}] }
  book: "/api/v5/outcomes/market/books", //    GET  ?assetId= &sz= → { asks:[[px,sz]], bids:[[px,sz]] }
  placeOrder: "/api/v5/outcomes/trade/order", // POST { assetId, side, ordType, px, sz } + EIP-712 action sig
} as const;
const TIMEOUT_MS = 10_000;

export class OutcomesError extends Error {
  constructor(public readonly path: string, public readonly code: string, msg: string) {
    super(`outcomes ${path}: code=${code} ${msg}`);
    this.name = "OutcomesError";
  }
}

/** OK-ACCESS HMAC headers — identical scheme to src/lib/okx.ts, reused verbatim. */
function signedHeaders(method: string, requestPath: string, body = ""): Record<string, string> {
  const ts = new Date().toISOString();
  const sign = createHmac("sha256", config.okx.secretKey)
    .update(ts + method + requestPath + body)
    .digest("base64");
  return {
    "OK-ACCESS-KEY": config.okx.apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": config.okx.passphrase,
    "Content-Type": "application/json",
  };
}

/** Cache-first signed GET/POST. Returns `data` (OKX envelope), or null on any failure. */
async function request<T>(
  path: string,
  opts: { method?: "GET" | "POST"; query?: Record<string, string | number>; body?: unknown; cache?: boolean } = {},
): Promise<T | null> {
  const method = opts.method ?? "GET";
  const qs = opts.query
    ? "?" + new URLSearchParams(Object.entries(opts.query).map(([k, v]) => [k, String(v)])).toString()
    : "";
  const requestPath = path + qs;
  const key = cacheKey(`outcomes:${path}`, { qs, body: opts.body ?? null });
  if (opts.cache !== false) {
    const hit = cacheGet<T | null>(key);
    if (hit !== undefined) return hit;
  }
  const bodyStr = opts.body === undefined ? "" : JSON.stringify(opts.body);
  try {
    const res = await fetch(BASE + requestPath, {
      method,
      headers: signedHeaders(method, requestPath, bodyStr),
      body: opts.body === undefined ? undefined : bodyStr,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json()) as { code?: string; msg?: string; data?: T };
    if (res.status !== 200 || json.code !== "0") {
      console.error(new OutcomesError(path, json.code ?? String(res.status), json.msg ?? "").message);
      return null;
    }
    const data = json.data ?? null;
    if (opts.cache !== false) cacheSet(key, data);
    return data;
  } catch (err) {
    console.error(new OutcomesError(path, "network", (err as Error).message).message);
    return null;
  }
}

// ── types ────────────────────────────────────────────────────────────────────
export interface OutcomeLeg {
  side: "yes" | "no";
  asset_id: string; // the tradable id — this is what an order carries
  price: number; // [0,1], ≈ implied probability
}
export interface OutcomesMarket {
  market_id: string;
  event_id: string;
  event_title: string;
  question: string;
  status: string; // active | paused | settling | resolved
  accepting_orders: boolean;
  neg_risk: boolean; // Binary vs NegRisk market (docs §14/§15)
  tick_size: number; // price increment
  yes: OutcomeLeg;
  no: OutcomeLeg;
}
export interface OutcomesBook {
  asset_id: string;
  best_bid: number | null;
  best_ask: number | null;
  asks: Array<[number, number]>; // [price, size] ascending
  bids: Array<[number, number]>; // [price, size] descending
}

// ── resolve: query → the tradable YES/NO legs ────────────────────────────────
// Reuses the same relevance posture as the Polymarket adapter (named-entity match
// before volume) — see [[prediction-lens-relevance-ranking]].
const STOP = new Set(["will", "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "by", "is", "be", "at"]);
const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

function scoreMarket(m: { question: string; event_title: string }, want: string[]): number {
  const hay = tokenize(`${m.event_title} ${m.question}`);
  const hits = want.filter((w) => hay.includes(w)).length;
  return want.length ? hits / want.length : 0;
}

interface RawEvent {
  eventId: string;
  title: string;
  markets: Array<{
    marketId: string;
    question: string;
    status?: string;
    acceptingOrders?: boolean;
    negRisk?: boolean;
    tickSize?: string;
    outcomes: Array<{ assetId: string; side?: string; outcome?: string; px?: string; price?: string }>;
  }>;
}

function toLeg(o: RawEvent["markets"][number]["outcomes"][number], want: "yes" | "no"): OutcomeLeg | null {
  const side = (o.side ?? o.outcome ?? "").toLowerCase();
  if (side !== want) return null;
  return { side: want, asset_id: o.assetId, price: Number(o.px ?? o.price ?? "0") };
}

/** Find the single most relevant open market for a plain-language query. */
export async function resolveOutcomeMarket(query: string): Promise<OutcomesMarket | null> {
  const events = await request<RawEvent[]>(PATHS.events, { query: { state: "active" } });
  if (!events?.length) return null;

  const want = tokenize(query);
  let best: { m: OutcomesMarket; score: number } | null = null;

  for (const ev of events) {
    for (const mk of ev.markets ?? []) {
      const yes = mk.outcomes.map((o) => toLeg(o, "yes")).find(Boolean) ?? null;
      const no = mk.outcomes.map((o) => toLeg(o, "no")).find(Boolean) ?? null;
      if (!yes || !no) continue;
      const market: OutcomesMarket = {
        market_id: mk.marketId,
        event_id: ev.eventId,
        event_title: ev.title,
        question: mk.question,
        status: mk.status ?? "active",
        accepting_orders: mk.acceptingOrders ?? true,
        neg_risk: mk.negRisk ?? false,
        tick_size: Number(mk.tickSize ?? "0.001"),
        yes,
        no,
      };
      const score = scoreMarket(market, want);
      if (!best || score > best.score) best = { m: market, score };
    }
  }
  // relevance floor — a specific query must actually match, else honest null
  return best && best.score >= 0.34 ? best.m : null;
}

/** Live order book for one outcome leg (by assetId). */
export async function fetchOutcomeBook(assetId: string): Promise<OutcomesBook | null> {
  const raw = await request<{ asks?: string[][]; bids?: string[][] }>(PATHS.book, {
    query: { assetId, sz: 50 },
    cache: false, // book must be fresh for sizing
  });
  if (!raw) return null;
  const num = (rows?: string[][]): Array<[number, number]> =>
    (rows ?? []).map((r) => [Number(r[0]), Number(r[1])] as [number, number]);
  const asks = num(raw.asks).sort((a, b) => a[0] - b[0]);
  const bids = num(raw.bids).sort((a, b) => b[0] - a[0]);
  return {
    asset_id: assetId,
    best_ask: asks[0]?.[0] ?? null,
    best_bid: bids[0]?.[0] ?? null,
    asks,
    bids,
  };
}

// ── order construction (draft only — buyer signs) ────────────────────────────
// The write action is the ONE place a key is involved, and it is NOT here: OKX
// signs the order action with an EIP-712 typed signature. Optic emits the exact
// action payload + typed-data to sign; the buyer's wallet produces the signature
// and POSTs it. `submitOutcomeOrder` is the buyer-side reference (used by the
// proof script), gated behind a provided signer — the service never calls it.
export interface OutcomeOrderDraft {
  asset_id: string;
  side: "buy" | "sell";
  ord_type: "limit"; // GTC limit; IOC/FOK available per docs
  px: string; // decimal string (docs: all decimals are strings)
  sz: string; // shares, decimal string
  // The EIP-712 action to be signed by the buyer. Struct name + domain are pinned
  // against OKX's official SDK in the deploy env (see order.ts write path).
  eip712_action: {
    action: "placeOrder";
    assetId: string;
    side: "buy" | "sell";
    price: string;
    size: string;
    // nonce/timestamp/expiry filled at sign time by the buyer's client
  };
}

/** Draft a YES/NO buy against the live book. Pure construction, no signing. */
export function buildOutcomeDraft(args: {
  leg: OutcomeLeg;
  book: OutcomesBook;
  xp: number; // budget in xp (base asset)
  limit?: number; // optional explicit limit price
  tick_size: number;
}): OutcomeOrderDraft {
  const ask = args.book.best_ask ?? args.leg.price;
  const px = args.limit ?? Math.min(0.999, ask);
  const round = (p: number) => Number((Math.round(p / args.tick_size) * args.tick_size).toFixed(6));
  const price = round(px);
  const shares = Number((args.xp / price).toFixed(2));
  return {
    asset_id: args.leg.asset_id,
    side: "buy",
    ord_type: "limit",
    px: price.toString(),
    sz: shares.toString(),
    eip712_action: { action: "placeOrder", assetId: args.leg.asset_id, side: "buy", price: price.toString(), size: shares.toString() },
  };
}
