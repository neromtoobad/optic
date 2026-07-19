import "dotenv/config";

function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 3000),
  priceUsdt: num("PRICE_USDT", 1),
  readBudgetUsd: num("READ_BUDGET_USD", 0.3),
  databasePath: process.env.DATABASE_PATH ?? "./data/optic.db",
  cardsDir: process.env.CARDS_DIR ?? "./data/cards",
  reelsDir: process.env.REELS_DIR ?? "./data/reels",
  assetsDir: process.env.ASSETS_DIR ?? "./data/assets",
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  cacheTtlSeconds: num("CACHE_TTL_SECONDS", 600),
  // Tolerant of casing/whitespace — "True", "TRUE", " true " must not silently
  // leave a live paid endpoint serving free reads.
  paymentsEnforced: (process.env.PAYMENTS_ENFORCED ?? "").trim().toLowerCase() === "true",
  payoutAddress: process.env.PAYOUT_ADDRESS ?? "",
  okx: {
    apiKey: process.env.OKX_API_KEY ?? "",
    secretKey: process.env.OKX_SECRET_KEY ?? "",
    passphrase: process.env.OKX_PASSPHRASE ?? "",
  },
  veniceApiKey: process.env.VENICE_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
};
