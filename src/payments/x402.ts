import type { Context, Next } from "hono";
import { config } from "../config.js";

// STUB (Phase 1). Phase 4: real x402 exact-scheme seller flow per
// okx/onchainos-skills dispatcher — verify settlement server-side, store tx
// hash on the read. Pattern: POST-only paid endpoints; GET on paid routes → 405.
export async function x402Middleware(c: Context, next: Next): Promise<Response | void> {
  if (!config.paymentsEnforced) return next();

  const paymentHeader = c.req.header("X-PAYMENT");
  if (!paymentHeader) {
    return c.json(
      {
        x402Version: 1,
        error: "payment required",
        accepts: [
          {
            scheme: "exact",
            network: "xlayer",
            maxAmountRequired: String(config.priceUsdt),
            asset: "USDT",
            payTo: config.payoutAddress,
            resource: "/v1/read",
            description: "OPTIC cross-venue narrative read (verdict JSON + card)",
          },
        ],
      },
      402
    );
  }

  // Phase 4 replaces this: verify settlement, attach tx hash to context.
  c.set("paidTx", "stub-not-verified");
  return next();
}
