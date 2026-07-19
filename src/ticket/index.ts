// TICKET DESK — the 8th service. Venue: OKX Event Contracts (v5 EVENTS, USDT-settled).
//
// "OKX AI has ASPs surfacing mispriced odds… What's missing is execution."
//
// The rule that keeps this inside Optic's spine: THE CALLER BRINGS THE CONVICTION.
// The request names the event, the side and the size; Optic resolves the live contract,
// reads the book, and drafts the exact order payload. It never chooses, never advises,
// never signs, never submits, never touches a trade key. The caller submits the draft
// with their OWN OKX API key. Every ticket is logged, like every pick.
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { isCliEntry } from "../fixtures.js";
import {
  buildEventDraft,
  fetchEventBook,
  resolveEventContract,
  type EventOrderDraft,
  type EventsBook,
} from "./events.js";

export interface Ticket {
  venue: "okx-events";
  settlement: "USDT";
  economics: {
    outcome: "Yes" | "No";
    inst_id: string;
    limit_price: number; // price of the submitted order (YES-book terms)
    contracts: number;
    usdt_at_risk: number;
  };
  draft: EventOrderDraft; // the caller submits this with their own OKX API key
}

export interface TicketVerdict {
  ticket_id: string | null;
  query: string;
  resolved: {
    type: "event_contract";
    inst_id: string;
    series_id: string;
    question: string;
    expiry_ms: number | null;
    state: string;
    vol_24h: number;
  } | null;
  book: EventsBook | null;
  ticket: Ticket | null;
  verdict_line: string;
  generated_at: string;
}

const now = () => new Date().toISOString();

db.exec(`CREATE TABLE IF NOT EXISTS event_ticket (
  id          TEXT PRIMARY KEY,
  inst_id     TEXT NOT NULL,
  question    TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  limit_price REAL NOT NULL,
  usdt        REAL NOT NULL,
  paid_tx     TEXT,
  created_at  TEXT NOT NULL
)`);

/** Settlement middleware attaches the on-chain fee tx to the ticket record. */
export function attachTicketTx(id: string, tx: string): void {
  db.prepare("UPDATE event_ticket SET paid_tx = ? WHERE id = ?").run(tx, id);
}

export interface TicketParams {
  query: string;
  side: "yes" | "no";
  usdt: number; // capital to commit, in USDT
  limit?: number; // optional explicit YES-side limit price in (0,1)
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
  const contract = await resolveEventContract(p.query);
  if (!contract)
    return fail(
      p.query,
      `No live OKX event contract matches "${p.query}" — name the asset and condition, e.g. "BTC above 60000 today" or "gold hits 4500 this month".`,
    );
  if (contract.state !== "live")
    return fail(p.query, `"${contract.question}" is not currently tradable (state: ${contract.state}).`);

  const book = await fetchEventBook(contract.inst_id);
  if (!book) return fail(p.query, `Book unavailable for "${contract.question}" — try again shortly.`);
  if (p.limit !== undefined && !(p.limit > 0 && p.limit < 1))
    return fail(p.query, `limit, when given, must be between 0 and 1 (got ${p.limit}).`);

  const draft = buildEventDraft({ contract, book, usdt: p.usdt, side: p.side, limit: p.limit });
  if (!draft)
    return fail(
      p.query,
      `Could not size an order for ${p.usdt} USDT on "${contract.question}" (min size ${contract.min_size}, book may be one-sided).`,
    );

  const price = Number(draft.payload.px);
  const contracts = Number(draft.payload.sz);
  const atRisk = Number((contracts * (p.side === "yes" ? price : 1 - price)).toFixed(2));
  const ticket: Ticket = {
    venue: "okx-events",
    settlement: "USDT",
    economics: {
      outcome: p.side === "yes" ? "Yes" : "No",
      inst_id: contract.inst_id,
      limit_price: price,
      contracts,
      usdt_at_risk: atRisk,
    },
    draft,
  };

  const ticketId = randomUUID();
  db.prepare(
    "INSERT INTO event_ticket (id, inst_id, question, outcome, limit_price, usdt, created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(ticketId, contract.inst_id, contract.question, ticket.economics.outcome, price, p.usdt, now());

  // Observational language only — the ticket reports what was CONSTRUCTED, never an
  // instruction (report-the-map rule; see src/lint.ts for the banned-word posture).
  return {
    ticket_id: ticketId,
    query: p.query,
    resolved: {
      type: "event_contract",
      inst_id: contract.inst_id,
      series_id: contract.series_id,
      question: contract.question,
      expiry_ms: contract.expiry_ms,
      state: contract.state,
      vol_24h: contract.vol_24h,
    },
    book,
    ticket,
    verdict_line:
      `Ticket constructed: ${ticket.economics.outcome} on "${contract.question}" — ` +
      `${contracts} contracts at ${price}, ${atRisk} USDT committed on OKX event contracts. ` +
      `Submit the draft with your own OKX API key to place.`,
    generated_at: now(),
  };
}

// CLI: npm run ticket -- "btc above 60000 today" yes 25 [limit]
if (isCliEntry(import.meta.url)) {
  const [q, side, usdt, limit] = process.argv.slice(2);
  planTicket({
    query: q || "btc above 60000 today",
    side: (side as "yes" | "no") || "yes",
    usdt: Number(usdt || 25),
    limit: limit ? Number(limit) : undefined,
  }).then((v) => console.log(JSON.stringify(v, null, 2)));
}
