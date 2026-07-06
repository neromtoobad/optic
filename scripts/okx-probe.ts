// Phase 0-B probe: one live call per Market API endpoint OPTIC needs.
// Records status, latency, and response shape; saves fixtures to /fixtures/okx.
// Usage: npx tsx scripts/okx-probe.ts [tokenQuery]
import "dotenv/config";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://web3.okx.com";
const KEY = process.env.OKX_API_KEY ?? "";
const SECRET = process.env.OKX_SECRET_KEY ?? "";
const PASSPHRASE = process.env.OKX_PASSPHRASE ?? "";
if (!KEY || !SECRET || !PASSPHRASE) {
  console.error("missing OKX creds in .env");
  process.exit(1);
}

function headers(method: string, requestPath: string, body = ""): Record<string, string> {
  const ts = new Date().toISOString();
  const sign = createHmac("sha256", SECRET).update(ts + method + requestPath + body).digest("base64");
  return {
    "OK-ACCESS-KEY": KEY,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": PASSPHRASE,
    "Content-Type": "application/json",
  };
}

interface ProbeResult {
  name: string;
  path: string;
  status: number;
  code: string | undefined;
  msg: string | undefined;
  latencyMs: number;
  ok: boolean;
}

const results: ProbeResult[] = [];
mkdirSync("./fixtures/okx", { recursive: true });

async function probe(name: string, requestPath: string, method = "GET", body?: unknown): Promise<any | null> {
  const started = Date.now();
  const bodyStr = body === undefined ? "" : JSON.stringify(body);
  try {
    const res = await fetch(BASE + requestPath, {
      method,
      headers: headers(method, requestPath, bodyStr),
      body: body === undefined ? undefined : bodyStr,
    });
    const latencyMs = Date.now() - started;
    const json = await res.json().catch(() => null);
    const ok = res.status === 200 && json?.code === "0";
    results.push({ name, path: requestPath.split("?")[0], status: res.status, code: json?.code, msg: json?.msg, latencyMs, ok });
    if (json) {
      writeFileSync(`./fixtures/okx/${name}.json`, JSON.stringify({ _meta: { path: requestPath, fetched: new Date().toISOString(), status: res.status, latencyMs }, ...json }, null, 2));
    }
    console.log(`${ok ? "✓" : "✗"} ${name} — HTTP ${res.status} code=${json?.code} msg=${json?.msg ?? ""} ${latencyMs}ms`);
    return ok ? json : json; // save even errors; caller checks
  } catch (err) {
    results.push({ name, path: requestPath.split("?")[0], status: 0, code: undefined, msg: String(err), latencyMs: Date.now() - started, ok: false });
    console.log(`✗ ${name} — ${err}`);
    return null;
  }
}

const query = process.argv[2] ?? "pepe";
const CHAIN = "501"; // solana

// 1. token search (Basic) — the resolve lens's canonicalizer
const search = await probe("token_search", `/api/v6/dex/market/token/search?search=${encodeURIComponent(query)}&chains=${CHAIN}`);
let symbol = "PEPE";
let address = "";
const first = search?.data?.[0]?.tokenInfos?.[0] ?? search?.data?.[0];
if (first) {
  symbol = first.tokenSymbol ?? first.symbol ?? symbol;
  address = first.tokenContractAddress ?? first.tokenAddress ?? "";
  console.log(`  resolved: ${symbol} @ ${address || "(no address)"}`);
}

// 2. social sentiment (tier unknown — this call tells us it works)
await probe("social_sentiment", `/api/v6/dex/market/social/sentiment/symbol?tokenSymbols=${encodeURIComponent(symbol)}&timeFrame=3&trendPoints=12`);

if (address) {
  // 3. vibe timeline + top KOLs
  await probe("social_vibe_timeline", `/api/v6/dex/market/social/vibe/timeline?chainIndex=${CHAIN}&tokenAddress=${address}&timeFrame=1`);
  await probe("social_top_kols", `/api/v6/dex/market/social/vibe/top-kols?chainIndex=${CHAIN}&tokenAddress=${address}&sortBy=3&timeFrame=1&limit=5`);
  // 4. trenches (Premium tokenDetails, Basic similarToken)
  await probe("memepump_token_details", `/api/v6/dex/market/memepump/tokenDetails?chainIndex=${CHAIN}&tokenContractAddress=${address}`);
  await probe("memepump_similar", `/api/v6/dex/market/memepump/similarToken?chainIndex=${CHAIN}&tokenContractAddress=${address}`);
  // 5. price (Basic) — POST with array body
  await probe("market_price", `/api/v6/dex/market/price`, "POST", [{ chainIndex: CHAIN, tokenContractAddress: address }]);
}

console.log("\n── summary ──");
console.table(results.map((r) => ({ endpoint: r.name, ok: r.ok, http: r.status, code: r.code, ms: r.latencyMs })));
const worstCaseCalls = 7;
console.log(`\nfee model (from docs, Jul 6): Basic $0.0001/call, Premium $0.0002/call AFTER 100K free calls/mo per tier.`);
console.log(`worst-case uncached read ≈ ${worstCaseCalls} calls ≈ $0.0011 post-quota — negligible vs READ_BUDGET_USD.`);

// 6. memepump token list — find a real trenches token for a proper tokenDetails fixture
const list = await probe("memepump_token_list", `/api/v6/dex/market/memepump/tokenList?chainIndex=501&protocolId=1&rankType=2&size=5&stage=MIGRATED`);
const listed = list?.data?.[0];
const listedAddr = listed?.tokenAddress ?? listed?.tokenContractAddress;
if (listedAddr) {
  console.log(`  trenches token: ${listed.symbol} @ ${listedAddr}`);
  await probe("memepump_token_details_real", `/api/v6/dex/market/memepump/tokenDetails?chainIndex=501&tokenContractAddress=${listedAddr}`);
  await probe("memepump_dev_info", `/api/v6/dex/market/memepump/tokenDevInfo?chainIndex=501&tokenContractAddress=${listedAddr}`);
}
