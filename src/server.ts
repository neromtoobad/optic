import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from "./config.js";
import { runRead } from "./pipeline/index.js";
import { createX402Middleware, READ_ID_HEADER, REEL_ID_HEADER, TICKET_ID_HEADER, PULSE_ID_HEADER, PAID_ROUTES } from "./payments/x402.js";
import type { ForceMode } from "./pipeline/index.js";
import { getRead } from "./db.js";
import { BudgetExceededError } from "./pipeline/budget.js";

const app = new Hono<{ Variables: { paidTx?: string } }>();

// Marketing site — served from the same origin as the API, so the page's live
// track-record fetch and card links need no CORS. optic.xyz-style custom domains
// attach to this same service later without touching the registered endpoints.
app.get("/", serveStatic({ path: "./site/index.html" }));
// Agent-facing API docs. Served from the same origin as the endpoints they
// describe, so every example on the page is copy-pasteable as-is.
app.get("/docs", serveStatic({ path: "./site/docs.html" }));
app.use("/assets/*", serveStatic({ root: "./site" }));

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
const NEEDS_QUERY = new Set<ForceMode | "read">(["read", "rug", "timing", "stocks", "touchgrass"]);

for (const route of PAID_ROUTES) {
  const mode = route.mode; // undefined = full cross-venue read
  const needsQuery = NEEDS_QUERY.has(mode ?? "read");

  // Reel, ticket and pulse are x402-gated (in PAID_ROUTES so the middleware challenges
  // them) but are not market reads — they have their own handlers below.
  if (route.path === "/v1/reel" || route.path === "/v1/ticket" || route.path === "/v1/pulse") continue;

  // Paid endpoints are POST-only; GET on a paid route → 405 (Onchain Data Explorer pattern).
  app.get(route.path, (c) => c.json({ error: "use POST" }, 405));

  app.post(route.path, paymentMiddleware, async (c) => {
    let query = "";
    let extras: { city?: string; tz?: string } | undefined;
    if (needsQuery) {
      let body: { query?: unknown; city?: unknown; tz?: unknown };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "invalid JSON body" }, 400);
      }
      query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return c.json({ error: "query is required (a token address, ticker, or subject)" }, 400);
      if (query.length > 200) return c.json({ error: "query must be ≤200 chars" }, 400);
      // TouchGrass personalization: optional city (weather) + IANA timezone.
      if (mode === "touchgrass") {
        extras = {
          city: typeof body.city === "string" ? body.city.trim().slice(0, 60) : undefined,
          tz: typeof body.tz === "string" ? body.tz.trim().slice(0, 60) : undefined,
        };
      }
    } else {
      query = mode ?? "read";
    }

    try {
      const { readId, verdict, costUsd } = await runRead(query, mode ? { forceMode: mode, extras } : {});
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

// ── AGENT REEL ─────────────────────────────────────────────────────────────
// Paid, POST-only, x402-gated (via PAID_ROUTES). Plans the reel synchronously (cheap:
// fetch brief + palette + tagline, a few seconds) so a bad agent id fails BEFORE
// settlement — then settles, then renders the ~90s MP4 in the background. The buyer
// gets reel_pending + a reel_url and polls GET /v1/reel/:id.mp4 (free).
app.get("/v1/reel", (c) => c.json({ error: "use POST" }, 405));

app.post("/v1/reel", paymentMiddleware, async (c) => {
  let body: { query?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return c.json({ error: "query is required — an agent id like 4380, or an okx.ai/agents/… link" }, 400);
  if (query.length > 200) return c.json({ error: "query must be ≤200 chars" }, 400);

  const { BudgetGuard } = await import("./pipeline/budget.js");
  const { planReel, produceReel } = await import("./reel/index.js");
  const { createJob, markDone, markFailed } = await import("./reel/jobs.js");
  const budget = new BudgetGuard();

  const { verdict, jobId } = await planReel(query, budget);

  // No agent / bad id → 4xx so the buyer is NOT charged (settlement only runs on <400).
  if (!jobId || !verdict.brief || !verdict.tagline || !verdict.palette) {
    return c.json(verdict, 404);
  }

  // Record the job and kick off the render — do NOT await it (render is ~90s; the buyer
  // gets an immediate reel_pending). The serialised queue in render.ts keeps concurrent
  // reels from fighting Chromium.
  createJob(jobId, verdict.brief.agent_id, verdict.brief.name);
  produceReel(jobId, verdict.brief, verdict.tagline, verdict.palette)
    .then(() => markDone(jobId))
    .catch((err) => {
      console.error(`reel ${jobId} render failed:`, err);
      markFailed(jobId, err instanceof Error ? err.message : String(err));
    });

  verdict.reel_url = `${config.publicBaseUrl || ""}/v1/reel/${jobId}.mp4`;
  c.header(REEL_ID_HEADER, jobId); // settlement attaches the tx to reel_jobs, then strips it
  return c.json(verdict);
});

// Free: serve the rendered MP4, or report status while it renders.
app.get("/v1/reel/:id", async (c) => {
  const id = c.req.param("id").replace(/\.mp4$/, "");
  const { reelPath } = await import("./reel/render.js");
  const { getJob } = await import("./reel/jobs.js");

  const path = reelPath(id);
  if (path) {
    const { readFileSync } = await import("node:fs");
    return c.body(new Uint8Array(readFileSync(path)), 200, {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  }
  const job = getJob(id);
  if (!job) return c.json({ error: "not found" }, 404);
  if (job.status === "failed") return c.json({ id, status: "failed", error: job.error }, 500);
  return c.json({ id, status: job.status, reel_pending: true });
});

// ── PULSE ──────────────────────────────────────────────────────────────────
// Paid, POST-only, x402-gated. The 5-minute cross-venue read: same up/down window
// priced on OKX event contracts AND Polymarket, divergence in points. No body needed.
app.get("/v1/pulse", (c) => c.json({ error: "use POST" }, 405));

app.post("/v1/pulse", paymentMiddleware, async (c) => {
  const { runPulse } = await import("./pulse.js");
  try {
    const verdict = await runPulse();
    if (!verdict.pulse_id) return c.json(verdict, 404); // no open windows → buyer keeps their money
    c.header(PULSE_ID_HEADER, verdict.pulse_id);
    return c.json(verdict);
  } catch (err) {
    console.error("/v1/pulse failed:", err);
    return c.json({ error: "pulse failed" }, 500);
  }
});

// ── TICKET DESK ────────────────────────────────────────────────────────────
// Paid, POST-only, x402-gated. Order CONSTRUCTION only: the caller names the market,
// side and size; the response is the signable payload their own wallet signs. Failures
// (no such market, dead book) return 4xx BEFORE settlement — never a charge for a
// ticket that can't exist.
app.get("/v1/ticket", (c) => c.json({ error: "use POST" }, 405));

app.post("/v1/ticket", paymentMiddleware, async (c) => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const side = typeof body.side === "string" ? body.side.trim().toLowerCase() : "";
  const usdt = Number(body.usdt);
  const limit = body.limit === undefined ? undefined : Number(body.limit);

  if (!query || query.length > 300)
    return c.json({ error: "query is required — an event in plain words, e.g. 'BTC above 60000 today' (≤300 chars)" }, 400);
  if (side !== "yes" && side !== "no")
    return c.json({ error: "side must be 'yes' or 'no' — the ticket desk constructs, it never chooses" }, 400);
  if (!Number.isFinite(usdt) || usdt < 1 || usdt > 10_000)
    return c.json({ error: "usdt must be a number between 1 and 10000 (capital to commit)" }, 400);
  if (limit !== undefined && !(limit > 0 && limit < 1))
    return c.json({ error: "limit, when given, must be between 0 and 1" }, 400);

  const { planTicket } = await import("./ticket/index.js");
  try {
    const verdict = await planTicket({ query, side, usdt, limit });
    if (!verdict.ticket) return c.json(verdict, 404); // not constructible → buyer keeps their money
    if (verdict.ticket_id) c.header(TICKET_ID_HEADER, verdict.ticket_id);
    return c.json(verdict);
  } catch (err) {
    console.error("/v1/ticket failed:", err);
    return c.json({ error: "ticket construction failed" }, 500);
  }
});

// Persistence guard: a mounted volume that the data paths don't point into means
// every deploy silently wipes reads, sales records, and served cards (bit us
// Jul 12 — vars were ./data/* while the volume mounts at /data; every posted
// card link died on the next deploy). Loud at boot so it can't regress quietly.
const volumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (volumeMount) {
  for (const [name, p] of [["DATABASE_PATH", config.databasePath], ["CARDS_DIR", config.cardsDir], ["REELS_DIR", config.reelsDir]] as const) {
    if (!p.startsWith(volumeMount)) {
      console.error(
        `!!! PERSISTENCE WARNING: volume mounted at ${volumeMount} but ${name}=${p} is NOT on it — ` +
          `data will be WIPED on every deploy. Set ${name} to a path under ${volumeMount}.`
      );
    }
  }
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // Boot diagnostic: shows exactly what the container saw for the payment flag,
  // so a misconfigured env is obvious in the deploy log (value is not a secret).
  const raw = process.env.PAYMENTS_ENFORCED;
  console.log(
    `OPTIC listening on :${info.port} (payments ${config.paymentsEnforced ? "ENFORCED" : "off — stub"}) ` +
      `[PAYMENTS_ENFORCED=${raw === undefined ? "<unset>" : JSON.stringify(raw)}, payout=${config.payoutAddress ? "set" : "MISSING"}]`
  );
});
