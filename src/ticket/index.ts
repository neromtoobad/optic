// TICKET DESK — the 8th service. Venue: OKX Outcomes (X Layer native).
//
// "OKX AI has ASPs surfacing mispriced odds… What's missing is execution."
//
// The rule that keeps this inside Optic's spine: THE CALLER BRINGS THE CONVICTION.
// The request names the market, the side and the size; Optic resolves the OKX Outcomes
// market, reads the live book, and drafts the signable order. It never chooses, never
// advises, never signs, never submits, never touches a key. Research → conviction →
// construction; the EIP-712 signature stays with the buyer. Every ticket is logged.
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { isCliEntry } from "../fixtures.js";
import {
  buildOutcomeDraft,
  fetchOutcomeBook,
  resolveOutcomeMarket,
  type OutcomeOrderDraft,
  type OutcomesBook,
} from "./outcomes.js";

export interface Ticket {
  venue: "okx-outcomes";
  settlement: "x-layer";
  economics: {
    outcome: "Yes" | "No";
    asset_id: string;
    limit_price: number;
    shares: number;
    xp_notional: number;
  };
  draft: OutcomeOrderDraft; // ready-to-sign; buyer's wallet produces the EIP-712 signature
}

export interface TicketVerdict {
  ticket_id: string | null;
  query: string;
  resolved: {
    type: "outcome_market";
    event_id: string;
    event_title: string;
    market_id: string;
    question: string;
    status: string;
    neg_risk: boolean;
  } | null;
  book: OutcomesBook | null;
  ticket: Ticket | null;
  verdict_line: string;
  generated_at: string;
}

const now = () => new Date().toISOString();

db.exec(`CREATE TABLE IF NOT EXISTS outcome_ticket (
  id          TEXT PRIMARY KEY,
  market_id   TEXT NOT NULL,
  question    TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  asset_id    TEXT NOT NULL,
  limit_price REAL NOT NULL,
  xp          REAL NOT NULL,
  signer      TEXT NOT NULL,
  paid_tx     TEXT,
  created_at  TEXT NOT NULL
)`);

/** Settlement middleware attaches the on-chain fee tx to the ticket record. */
export function attachTicketTx(id: string, tx: string): void {
  db.prepare("UPDATE outcome_ticket SET paid_tx = ? WHERE id = ?").run(tx, id);
}

export interface TicketParams {
  query: string;
  side: "yes" | "no";
  xp: number; // budget in xp (OKX X-Layer Points — the venue base asset)
  limit?: number; // optional explicit limit price in [0,1]
  signer: string; // the X Layer address whose key will sign the order (for the record)
}

function fail(query: string, line: string): TicketVerdict {
  return {
    ticket_id: null,
    query,
    resolved: null,
    book: null,
    ticket: null,
    verdict_line: line,
    generated_at: now(),
  };
}

export async function planTicket(p: TicketParams): Promise<TicketVerdict> {
  const market = await resolveOutcomeMarket(p.query);
  if (!market)
    return fail(
      p.query,
      `No open OKX Outcomes market matches "${p.query}" — try the exact event or question wording.`,
    );
  if (!market.accepting_orders || market.status !== "active")
    return fail(p.query, `"${market.question}" is not currently accepting orders (status: ${market.status}).`);

  const leg = p.side === "yes" ? market.yes : market.no;
  const book = await fetchOutcomeBook(leg.asset_id);
  if (!book) return fail(p.query, `Book unavailable for "${market.question}" — try again shortly.`);
  if (p.limit !== undefined && !(p.limit > 0 && p.limit < 1))
    return fail(p.query, `limit, when given, must be between 0 and 1 (got ${p.limit}).`);

  const draft = buildOutcomeDraft({ leg, book, xp: p.xp, limit: p.limit, tick_size: market.tick_size });
  const shares = Number(draft.sz);
  const price = Number(draft.px);
  if (!(shares > 0) || !(price > 0))
    return fail(p.query, `Could not size an order for ${p.xp} xp on "${market.question}".`);

  const ticket: Ticket = {
    venue: "okx-outcomes",
    settlement: "x-layer",
    economics: {
      outcome: p.side === "yes" ? "Yes" : "No",
      asset_id: leg.asset_id,
      limit_price: price,
      shares,
      xp_notional: Number((shares * price).toFixed(2)),
    },
    draft,
  };

  const ticketId = randomUUID();
  db.prepare(
    "INSERT INTO outcome_ticket (id, market_id, question, outcome, asset_id, limit_price, xp, signer, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(
    ticketId,
    market.market_id,
    market.question,
    ticket.economics.outcome,
    leg.asset_id,
    price,
    p.xp,
    p.signer,
    now(),
  );

  // Observational language only — the ticket reports what was CONSTRUCTED, never an
  // instruction (report-the-map rule; see src/lint.ts for the banned-word posture).
  return {
    ticket_id: ticketId,
    query: p.query,
    resolved: {
      type: "outcome_market",
      event_id: market.event_id,
      event_title: market.event_title,
      market_id: market.market_id,
      question: market.question,
      status: market.status,
      neg_risk: market.neg_risk,
    },
    book,
    ticket,
    verdict_line:
      `Ticket constructed: ${ticket.economics.outcome} on "${market.question}" — ` +
      `${ticket.economics.shares} shares at ${ticket.economics.limit_price}, ` +
      `${ticket.economics.xp_notional} xp notional on OKX Outcomes (X Layer). ` +
      `Sign the order action with the maker key and submit to place.`,
    generated_at: now(),
  };
}

// CLI: npm run ticket -- "germany to win" yes 50 [limit]
if (isCliEntry(import.meta.url)) {
  const [q, side, xp, limit] = process.argv.slice(2);
  planTicket({
    query: q || "germany to win",
    side: (side as "yes" | "no") || "yes",
    xp: Number(xp || 50),
    limit: limit ? Number(limit) : undefined,
    signer: process.env.TICKET_SIGNER || "0x58eD891E73F631d1d80d8296559f90Dbfb2e71fD",
  }).then((v) => console.log(JSON.stringify(v, null, 2)));
}
