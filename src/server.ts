import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { runRead } from "./pipeline/index.js";
import { createX402Middleware, READ_ID_HEADER, PAID_ROUTES } from "./payments/x402.js";
import type { ForceMode } from "./pipeline/index.js";
import { getRead } from "./db.js";
import { BudgetExceededError } from "./pipeline/budget.js";

const app = new Hono<{ Variables: { paidTx?: string } }>();

app.get("/v1/health", (c) =>
  c.json({
    ok: true,
    service: "optic",
    // Free, non-secret operational signal — lets us confirm payment enforcement
    // without POSTing (a POST runs a paid read when payments are off).
    payments_enforced: config.paymentsEnforced,
    price_usdt: config.priceUsdt,
    ts: new Date().toISOString(),
  })
);

// Free, public track record — OPTIC's real hit rate on surfaced prediction reads,
// scored as markets resolve on-chain. Lazily resolves any newly-closed markets first.
app.get("/v1/track-record", async (c) => {
  const { resolveOpenPicks, trackRecord } = await import("./track/picks.js");
  await resolveOpenPicks().catch(() => {});
  const r = trackRecord();
  return c.json({
    ...r,
    note:
      "OPTIC surfaces the market-favored outcome and records how those reads resolve. This is a calibration record, not a claim to beat the market. avg_implied_prob shows how favored the picks were.",
  });
});

// One x402 middleware guards every paid route (per-route pricing in PAID_ROUTES).
const paymentMiddleware = createX402Middleware();

// Modes that need a query param (a token/subject); discovery modes ignore the body.
const NEEDS_QUERY = new Set<ForceMode | "read">(["read", "rug", "timing", "stocks"]);

for (const route of PAID_ROUTES) {
  const mode = route.mode; // undefined = full cross-venue read
  const needsQuery = NEEDS_QUERY.has(mode ?? "read");

  // Paid endpoints are POST-only; GET on a paid route → 405 (Onchain Data Explorer pattern).
  app.get(route.path, (c) => c.json({ error: "use POST" }, 405));

  app.post(route.path, paymentMiddleware, async (c) => {
    let query = "";
    if (needsQuery) {
      let body: { query?: unknown };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "invalid JSON body" }, 400);
      }
      query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return c.json({ error: "query is required (a token address, ticker, or subject)" }, 400);
      if (query.length > 200) return c.json({ error: "query must be ≤200 chars" }, 400);
    } else {
      query = mode ?? "read";
    }

    try {
      const { readId, verdict, costUsd } = await runRead(query, mode ? { forceMode: mode } : {});
      console.log(`${route.path} ${readId} complete — cost $${costUsd.toFixed(4)}`);
      c.header(READ_ID_HEADER, readId); // settlement middleware attaches tx hash, then strips it
      return c.json(verdict);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        console.error(`${route.path} failed on budget: ${err.message}`);
        return c.json({ error: "read exceeded cost budget and was aborted; you were not charged" }, 503);
      }
      console.error(`${route.path} failed:`, err);
      return c.json({ error: "read failed" }, 500);
    }
  });
}

app.get("/v1/card/:id", async (c) => {
  const id = c.req.param("id");
  const { cardPath } = await import("./card/render.js");
  const path = cardPath(id);
  if (path) {
    const { readFileSync } = await import("node:fs");
    return c.body(new Uint8Array(readFileSync(path)), 200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  }
  const read = getRead(id);
  if (!read) return c.json({ error: "not found" }, 404);
  return c.json({ id: read.id, status: read.status, card_pending: true });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // Boot diagnostic: shows exactly what the container saw for the payment flag,
  // so a misconfigured env is obvious in the deploy log (value is not a secret).
  const raw = process.env.PAYMENTS_ENFORCED;
  console.log(
    `OPTIC listening on :${info.port} (payments ${config.paymentsEnforced ? "ENFORCED" : "off — stub"}) ` +
      `[PAYMENTS_ENFORCED=${raw === undefined ? "<unset>" : JSON.stringify(raw)}, payout=${config.payoutAddress ? "set" : "MISSING"}]`
  );
});
