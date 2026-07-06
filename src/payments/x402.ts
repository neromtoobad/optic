import type { Context, Next } from "hono";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import {
  FacilitatorResponseError,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@okxweb3/x402-core/server";
import type { HTTPAdapter, HTTPRequestContext, RoutesConfig } from "@okxweb3/x402-core/server";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { config } from "../config.js";
import { db } from "../db.js";

// X Layer — zero gas, USDT settlement, same chain as OPTIC's ASP identity (#4380).
const NETWORK = "eip155:196" as const;

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
  const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
  const routes: RoutesConfig = {
    "POST /v1/read": {
      accepts: [
        {
          scheme: "exact",
          network: NETWORK,
          payTo: config.payoutAddress,
          price: `$${config.priceUsdt}`,
        },
      ],
      description: "OPTIC cross-venue market read: verdict JSON + shareable card",
      mimeType: "application/json",
    },
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
      c.res = instructionsToResponse(result.response);
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
