// AGENT REEL — the data spine.
//
// Every service in this studio starts from one thing: the buyer's real listing on
// OKX.AI. The public agent page is server-rendered with the full payload embedded,
// so a plain unauthenticated GET returns the entire creative brief — no API key, no
// request signing, no CLI. (The priapi JSON endpoint requires a signature; the page
// does not. Verified Jul 17.)
//
// PARSING RULE — the page carries TWO agent payloads: the requested agent first,
// then a `"similar":[…]` block of unrelated agents for the "Explore More" rail.
// Scraping the whole page silently returns a competitor's price and services. So we
// cut at `"similar"` first; inside that region agentId/score/usageCount/services each
// appear exactly once. Prices live per-service inside the services array — the
// top-level `startingPrice` field only exists on the similar-agent cards.
import { db } from "../db.js";
import { isCliEntry } from "../fixtures.js";

export interface AgentService {
  name: string;
  price: string; // USDT, per call, as listed
  description: string;
}

export interface AgentBrief {
  agent_id: string;
  name: string;
  description: string;
  avatar: string | null;
  score: string | null; // "5.0" — null on agents with no reviews yet
  approval_rate: string | null; // "100%"
  sold: number;
  services: AgentService[];
  cheapest: string | null; // derived from services, not the page's startingPrice
  fetched_at: string;
}

const PAGE = (id: string) => `https://www.okx.ai/agents/${encodeURIComponent(id)}`;
const CACHE_TTL_MS = 10 * 60 * 1000;

function one(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? m[1] : null;
}

function unescape(s: string): string {
  return s
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull the `"services":{…"list":[…]}` array out of the own-agent region. */
function parseServices(own: string): AgentService[] {
  const start = own.indexOf('"services"');
  if (start < 0) return [];
  const listStart = own.indexOf('"list":[', start);
  if (listStart < 0) return [];

  // walk the array with a bracket counter — regex can't survive nested objects
  let depth = 0;
  let i = own.indexOf("[", listStart);
  const from = i;
  for (; i < own.length; i++) {
    if (own[i] === "[") depth++;
    else if (own[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  const raw = own.slice(from, i + 1);
  try {
    const list = JSON.parse(raw) as Array<{
      name?: string;
      price?: string;
      description?: string;
    }>;
    return list
      .filter((s) => s.name)
      .map((s) => ({
        name: String(s.name),
        price: String(s.price ?? ""),
        description: unescape(String(s.description ?? "")),
      }));
  } catch {
    return [];
  }
}

function parse(id: string, html: string): AgentBrief | null {
  // everything before "similar" belongs to the requested agent
  const cut = html.indexOf('"similar"');
  const own = cut > 0 ? html.slice(0, cut) : html;

  const name = one(own, /"name"\s*:\s*"([^"]{2,60})"/);
  if (!name) return null;

  const services = parseServices(own);

  // the agent's own blurb is the longest description in its region
  const descs = [...own.matchAll(/"description"\s*:\s*"((?:[^"\\]|\\.){40,4000})"/g)].map(
    (m) => unescape(m[1]),
  );
  const serviceDescs = new Set(services.map((s) => s.description));
  const description =
    descs.filter((d) => !serviceDescs.has(d)).sort((a, b) => b.length - a.length)[0] ??
    descs.sort((a, b) => b.length - a.length)[0] ??
    "";

  const prices = services
    .map((s) => Number(s.price))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    agent_id: one(own, /"agentId"\s*:\s*"?(\d+)"?/) ?? id,
    name,
    description,
    avatar: one(own, /"avatar"\s*:\s*"(https:\/\/[^"]+)"/),
    score: one(own, /"score"\s*:\s*"([\d.]+)"/),
    approval_rate: one(own, /"approvalRate"\s*:\s*"([^"]+)"/),
    sold: Number(one(own, /"usageCount"\s*:\s*(\d+)/) ?? 0),
    services,
    cheapest: prices.length ? String(Math.min(...prices)) : null,
    fetched_at: new Date().toISOString(),
  };
}

db.exec(`CREATE TABLE IF NOT EXISTS agent_brief (
  agent_id TEXT PRIMARY KEY,
  json     TEXT NOT NULL,
  ts       INTEGER NOT NULL
)`);

function cached(id: string): AgentBrief | null {
  const row = db
    .prepare("SELECT json, ts FROM agent_brief WHERE agent_id = ?")
    .get(id) as { json: string; ts: number } | undefined;
  if (!row || Date.now() - row.ts > CACHE_TTL_MS) return null;
  return JSON.parse(row.json) as AgentBrief;
}

function store(brief: AgentBrief): void {
  db.prepare(
    "INSERT INTO agent_brief (agent_id, json, ts) VALUES (?, ?, ?) " +
      "ON CONFLICT(agent_id) DO UPDATE SET json = excluded.json, ts = excluded.ts",
  ).run(brief.agent_id, JSON.stringify(brief), Date.now());
}

/** Resolve "4380" / "#4380" / a full listing URL to a bare id. */
export function normalizeAgentId(query: string): string | null {
  const q = query.trim();
  const fromUrl = q.match(/agents\/(\d+)/);
  if (fromUrl) return fromUrl[1];
  const bare = q.match(/^#?(\d{1,8})$/);
  return bare ? bare[1] : null;
}

/** Fetch (and cache) the real listing brief for an agent. Null if it doesn't exist. */
export async function fetchAgentBrief(id: string): Promise<AgentBrief | null> {
  const hit = cached(id);
  if (hit) return hit;

  const res = await fetch(PAGE(id), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) return null;

  const brief = parse(id, await res.text());
  if (!brief?.name) return null;
  store(brief);
  return brief;
}

// CLI: npm run reel-brief -- 4380
if (isCliEntry(import.meta.url)) {
  const id = normalizeAgentId(process.argv.slice(2).join(" ") || "4380");
  if (!id) {
    console.error("usage: npm run reel-brief -- <agent id | listing url>");
    process.exit(1);
  }
  fetchAgentBrief(id).then((b) => console.log(JSON.stringify(b, null, 2)));
}
