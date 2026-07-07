import type { Context, Next } from "hono";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import {
  FacilitatorResponseError,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@okxweb3/x402-core/server";
import type { HTTPAdapter, HTTPRequestContext, RoutesConfig } from "@okxweb3/x402-core/server";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { AggrDeferredEvmScheme } from "@okxweb3/x402-evm/deferred/server";
import { config } from "../config.js";
import { db } from "../db.js";

// X Layer — zero gas, USDT settlement, same chain as OPTIC's ASP identity (#4380).
const NETWORK = "eip155:196" as const;

// The marketplace service lineup — each path is a distinct x402-gated service.
// Cheap data services (~$0 cost) drive order volume; premium reads carry research/LLM cost.
export const PAID_ROUTES: Array<{ path: string; price: number; description: string; mode?: import("../pipeline/index.js").ForceMode }> = [
  { path: "/v1/read", price: 0.5, description: "Optic AI cross-venue market read: verdict JSON + shareable card" },
  { path: "/v1/edge", price: 0.5, description: "Optic AI edge radar: today's mispriced markets, research vs price", mode: "edge" },
  { path: "/v1/daily", price: 0.5, description: "Optic AI daily alpha: today's research-backed picks", mode: "daily" },
  { path: "/v1/rug", price: 0.05, description: "Optic AI rug radar: token safety score + red flags", mode: "rug" },
  { path: "/v1/smart-money", price: 0.05, description: "Optic AI smart money: tokens sharp wallets are accumulating", mode: "smartmoney" },
  { path: "/v1/timing", price: 0.05, description: "Optic AI narrative timing: early vs late lifecycle for any token", mode: "timing" },
];

/** Header the read handler sets so settlement can attach the tx to the read row. */
export const READ_ID_HEADER = "x-optic-read-id";

/** Hono implementation of the SDK's HTTPAdapter (mirrors ExpressAdapter). */
class HonoAdapter implements HTTPAdapter {
  constructor(private readonly c: Context, private readonly parsedBody: unknown) {}
  getHeader(name: string): string | undefined {
    return this.c.req.header(name) ?? undefined;
  }
  getMethod(): string {
    return this.c.req.method;
  }
  getPath(): string {
    return new URL(this.c.req.url).pathname;
  }
  getUrl(): string {
    return this.c.req.url;
  }
  getAcceptHeader(): string {
    return this.c.req.header("Accept") ?? "";
  }
  getUserAgent(): string {
    return this.c.req.header("User-Agent") ?? "";
  }
  getQueryParams(): Record<string, string | string[]> {
    return this.c.req.queries() as Record<string, string | string[]>;
  }
  getQueryParam(name: string): string | string[] | undefined {
    return this.c.req.query(name);
  }
  getBody(): unknown {
    return this.parsedBody;
  }
}

function instructionsToResponse(response: {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  isHtml?: boolean;
}): Response {
  const headers = new Headers(response.headers);
  if (response.isHtml) {
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(String(response.body ?? ""), { status: response.status, headers });
  }
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(response.body ?? {}), { status: response.status, headers });
}

// OKX's listing-time "x402 verification" needs each accepts entry to fully
// describe the settlement token in `extra`: `symbol` (which token — USDT0's
// address 0x779ded… is NOT in OKX's by-address USDT/USDG registry, so the symbol
// is how it's identified), `transferMethod` ("eip3009" — how to settle it), plus
// `name`/`version` for the EIP-712 domain and `decimals` for price resolution.
// The stock x402 SDK emits only {name, version}; an APPROVED reference agent
// (Onchain Data Explorer, same USDT0 asset) emits {name, version, symbol,
// transferMethod}. We enrich the emitted 402 challenge to match.
//
// All of this goes ONLY inside `extra`, never in the base object. The facilitator's
// requirement matcher deep-equals the base (everything except `extra`) and only
// checks the SERVER's extra keys against the buyer — so surplus extra keys echoed
// by the buyer are ignored and still match, whereas a new base field would break
// the match ("No matching payment requirements"). Buyer signs EIP-3009 over
// from/to/value/nonce (never these), so settlement is unaffected (proven live).
const SETTLEMENT_EXTRA: Record<string, unknown> = {
  symbol: "USDT",
  transferMethod: "eip3009",
  decimals: 6,
};

function injectAssetDecimals(response: {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  isHtml?: boolean;
}): typeof response {
  const headers = { ...response.headers };
  const patchAccepts = (obj: unknown): boolean => {
    if (!obj || typeof obj !== "object") return false;
    // Force the resource URL to https — Railway terminates TLS and forwards
    // http internally, so the SDK stamps an http:// resource.url that a security-
    // conscious verifier can reject. resource is not part of the accepts entry the
    // matcher compares, so rewriting it is settlement-safe.
    const resource = (obj as { resource?: { url?: unknown } }).resource;
    if (resource && typeof resource.url === "string" && resource.url.startsWith("http://")) {
      resource.url = "https://" + resource.url.slice("http://".length);
    }
    const accepts = (obj as { accepts?: unknown }).accepts;
    if (!Array.isArray(accepts)) return false;
    for (const a of accepts) {
      if (a && typeof a === "object") {
        const entry = a as Record<string, unknown>;
        if (entry.extra && typeof entry.extra === "object") {
          const extra = entry.extra as Record<string, unknown>;
          for (const [k, v] of Object.entries(SETTLEMENT_EXTRA)) {
            if (extra[k] === undefined) extra[k] = v;
          }
        }
      }
    }
    return true;
  };

  // The challenge rides in the base64 PAYMENT-REQUIRED header (and, defensively,
  // the JSON body if a server variant echoes it there).
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "payment-required") {
      try {
        const decoded = JSON.parse(Buffer.from(headers[key], "base64").toString("utf8"));
        if (patchAccepts(decoded)) headers[key] = Buffer.from(JSON.stringify(decoded)).toString("base64");
      } catch {
        /* leave the header untouched if it isn't decodable JSON */
      }
    }
  }
  let body = response.body;
  if (body && typeof body === "object") {
    const clone = JSON.parse(JSON.stringify(body));
    if (patchAccepts(clone)) body = clone;
  }
  return { ...response, headers, body };
}

/**
 * Real x402 seller middleware (Phase 4), ported from @okxweb3/x402-express to
 * Hono. Unpaid POSTs get the 402 PAYMENT-REQUIRED challenge; signed requests
 * are verified BEFORE the pipeline runs and settled AFTER it succeeds — a read
 * that fails is never charged. The facilitator (OKX Broker) does all on-chain
 * work; we hold no keys beyond the payout address.
 */
export function createX402Middleware(): (c: Context, next: Next) => Promise<Response | void> {
  if (!config.paymentsEnforced) {
    return async (_c, next) => next();
  }
  if (!config.payoutAddress) {
    throw new Error("PAYMENTS_ENFORCED=true requires PAYOUT_ADDRESS");
  }

  const facilitator = new OKXFacilitatorClient({
    apiKey: config.okx.apiKey,
    secretKey: config.okx.secretKey,
    passphrase: config.okx.passphrase,
  });
  // Register BOTH schemes. OKX's listing x402 verification (and A2MCP pay-per-call)
  // expects the deferred scheme offered alongside exact — every approved OKX A2MCP
  // agent advertises exact + aggr_deferred. The facilitator settles aggr_deferred
  // asynchronously (status=success immediately, no polling). Buyers' `payment pay`
  // auto-selects exact first, so existing settlement is unchanged.
  const resourceServer = new x402ResourceServer(facilitator)
    .register(NETWORK, new ExactEvmScheme())
    .register(NETWORK, new AggrDeferredEvmScheme());
  const routes: RoutesConfig = {
    ...Object.fromEntries(
      PAID_ROUTES.map((r) => [
        `POST ${r.path}`,
        {
          accepts: [
            { scheme: "exact", network: NETWORK, payTo: config.payoutAddress, price: `$${r.price}` },
            { scheme: "aggr_deferred", network: NETWORK, payTo: config.payoutAddress, price: `$${r.price}` },
          ],
          description: r.description,
          mimeType: "application/json",
        },
      ])
    ),
  };
  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  let initialized = false;
  let initPromise: Promise<void> | null = null;
  const ensureInitialized = async () => {
    if (initialized) return;
    initPromise ??= httpServer.initialize();
    try {
      await initPromise;
      initialized = true;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  };

  return async (c, next) => {
    const parsedBody = await c.req.raw
      .clone()
      .json()
      .catch(() => undefined);
    const adapter = new HonoAdapter(c, parsedBody);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: c.req.method,
      paymentHeader: c.req.header("payment-signature") ?? c.req.header("x-payment"),
    };

    if (!httpServer.requiresPayment(context)) return next();

    try {
      await ensureInitialized();
    } catch (err) {
      if (err instanceof FacilitatorResponseError) {
        return c.json({ error: err.message }, 502);
      }
      throw err;
    }

    let result;
    try {
      result = await httpServer.processHTTPRequest(context);
    } catch (err) {
      if (err instanceof FacilitatorResponseError) {
        return c.json({ error: err.message }, 502);
      }
      throw err;
    }

    if (result.type === "no-payment-required") return next();
    if (result.type === "payment-error") {
      c.res = instructionsToResponse(injectAssetDecimals(result.response));
      return;
    }

    // payment-verified: run the read, settle only on success.
    await next();

    if (c.res.status >= 400) return; // failed read → buyer keeps their money

    const responseBody = Buffer.from(await c.res.clone().arrayBuffer());
    try {
      const settle = await httpServer.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        { request: context, responseBody, responseHeaders: {} }
      );

      if (!settle.success) {
        c.res = instructionsToResponse(settle.response);
        return;
      }

      // Attach settlement headers (PAYMENT-RESPONSE) + record the tx on the read.
      const readId = c.res.headers.get(READ_ID_HEADER);
      if (readId && settle.transaction) {
        db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(settle.transaction, readId);
        console.log(`read ${readId} settled — tx ${settle.transaction} (${settle.status ?? "success"})`);
      }
      const headers = new Headers(c.res.headers);
      headers.delete(READ_ID_HEADER);
      for (const [k, v] of Object.entries(settle.headers)) headers.set(k, v);
      c.res = new Response(c.res.body, { status: c.res.status, headers });
    } catch (err) {
      if (err instanceof FacilitatorResponseError) {
        c.res = c.newResponse(JSON.stringify({ error: err.message }), 502, {
          "Content-Type": "application/json",
        });
        return;
      }
      console.error("settlement error:", err);
      c.res = c.newResponse(JSON.stringify({ error: "settlement failed" }), 402, {
        "Content-Type": "application/json",
      });
    }
  };
}
