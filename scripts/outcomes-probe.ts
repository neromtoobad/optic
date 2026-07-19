// OKX OUTCOMES — endpoint + shape probe. STAGED FOR DEPLOY.
//
// okx.com is firewalled from the build sandbox, so the exact REST paths and JSON field
// names in src/ticket/outcomes.ts (the PATHS block + the Raw* parsing) are pinned HERE,
// in an env where okx.com resolves: the deploy box, or any shell that can reach OKX.
//
//   Run:  npx tsx scripts/outcomes-probe.ts
//   Needs: OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE in env (same creds as the lenses).
//
// It (1) confirms the venue is reachable and auth is accepted, (2) tries candidate paths
// for events/market/book/order and reports which return code=0, (3) dumps ONE live
// event→market→outcome→book so the real field names can be checked against outcomes.ts,
// and (4) reminds where the EIP-712 order struct is pinned from. Read the report, then
// correct PATHS + the Raw* field access in outcomes.ts to match, and commit.
import "dotenv/config";
import { createHmac } from "node:crypto";

const BASE = "https://www.okx.com";
const KEY = process.env.OKX_API_KEY ?? "";
const SECRET = process.env.OKX_SECRET_KEY ?? "";
const PASS = process.env.OKX_PASSPHRASE ?? "";

function headers(method: string, requestPath: string, body = ""): Record<string, string> {
  const ts = new Date().toISOString();
  const sign = createHmac("sha256", SECRET).update(ts + method + requestPath + body).digest("base64");
  return {
    "OK-ACCESS-KEY": KEY,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": PASS,
    "Content-Type": "application/json",
  };
}

async function get(path: string): Promise<{ ok: boolean; code?: string; msg?: string; data?: unknown }> {
  try {
    const res = await fetch(BASE + path, { method: "GET", headers: headers("GET", path), signal: AbortSignal.timeout(12_000) });
    const j = (await res.json()) as { code?: string; msg?: string; data?: unknown };
    return { ok: res.status === 200 && j.code === "0", code: j.code, msg: j.msg, data: j.data };
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  }
}

// Candidate path shapes for each capability — the probe reports which resolve.
const CANDIDATES = {
  events: [
    "/api/v5/outcomes/public/events?state=active",
    "/api/v5/outcomes/public/events",
    "/api/v5/outcomes/events?state=active",
    "/api/v5/public/instruments?instType=EVENTS",
  ],
  markets: [
    "/api/v5/outcomes/public/markets",
    "/api/v5/outcomes/markets",
    "/api/v5/outcomes/public/market",
  ],
  book: [
    "/api/v5/outcomes/market/books?assetId={ASSET}&sz=20",
    "/api/v5/outcomes/market/book?assetId={ASSET}",
    "/api/v5/market/books?instId={ASSET}",
  ],
};

async function main() {
  console.log("== OKX Outcomes probe ==");
  if (!KEY || !SECRET || !PASS) {
    console.error("MISSING creds — set OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE and re-run.");
    process.exit(1);
  }
  console.log("reachability:", (await get("/api/v5/public/time")).ok ? "OK (okx.com reachable)" : "FAILED (okx.com unreachable here — run on the deploy box)");

  // 1. events — find a working path + capture one event
  console.log("\n-- events --");
  let firstEvent: Record<string, unknown> | null = null;
  let eventsPath = "";
  for (const p of CANDIDATES.events) {
    const r = await get(p);
    console.log(`  ${r.ok ? "✓" : "·"} ${p}  ${r.ok ? "" : `(code=${r.code ?? "?"} ${r.msg ?? ""})`}`.trim());
    if (r.ok && Array.isArray(r.data) && r.data.length && !firstEvent) {
      firstEvent = r.data[0] as Record<string, unknown>;
      eventsPath = p;
    }
  }
  if (firstEvent) {
    console.log("  PIN events ->", eventsPath);
    console.log("  sample event keys:", Object.keys(firstEvent).join(", "));
    console.log("  sample event:", JSON.stringify(firstEvent).slice(0, 700));
  } else {
    console.log("  no events path returned data — inspect the docs REST section and add the real path above.");
  }

  // 2. market + outcomes — pull the assetId of a YES leg
  let assetId = "";
  const markets = (firstEvent?.markets ?? firstEvent?.marketList) as Array<Record<string, unknown>> | undefined;
  if (markets?.length) {
    const mk = markets[0];
    console.log("\n-- market --");
    console.log("  sample market keys:", Object.keys(mk).join(", "));
    const outs = (mk.outcomes ?? mk.outcomeList) as Array<Record<string, unknown>> | undefined;
    if (outs?.length) {
      console.log("  sample outcome keys:", Object.keys(outs[0]).join(", "));
      console.log("  outcomes:", JSON.stringify(outs).slice(0, 400));
      const yes = outs.find((o) => String(o.side ?? o.outcome ?? "").toLowerCase() === "yes") ?? outs[0];
      assetId = String(yes.assetId ?? yes.asset_id ?? yes.id ?? "");
    }
  }

  // 3. book — for that assetId
  console.log("\n-- book --", assetId ? `(assetId ${assetId})` : "(no assetId found — skipping)");
  if (assetId) {
    for (const tmpl of CANDIDATES.book) {
      const p = tmpl.replace("{ASSET}", assetId);
      const r = await get(p);
      console.log(`  ${r.ok ? "✓" : "·"} ${p}  ${r.ok ? "" : `(code=${r.code ?? "?"} ${r.msg ?? ""})`}`.trim());
      if (r.ok) console.log("    book keys:", Object.keys((r.data as Record<string, unknown>) ?? {}).join(", "), "->", JSON.stringify(r.data).slice(0, 300));
    }
  }

  console.log("\n-- order placement + EIP-712 --");
  console.log("  Order write path (docs): POST /api/v5/outcomes/trade/order");
  console.log("  Signing: OK-ACCESS HMAC headers (as above) + an EIP-712 signature over the order action.");
  console.log("  PIN the EIP-712 struct/domain from OKX's official Outcomes SDK (docs-v5/outcomes_en, SDK API Reference),");
  console.log("  then fill outcomes.ts OutcomeOrderDraft.eip712_action's typed-data. Do NOT hand-guess the struct.");
  console.log("\nDONE. Update src/ticket/outcomes.ts PATHS + Raw* field access to match the ✓ paths and sample keys above.");
}

main().catch((e) => { console.error("probe failed:", (e as Error).message); process.exit(1); });
