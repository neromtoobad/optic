// Reel job ledger.
//
// A reel is paid up front but renders for ~90s, so the buyer gets `reel_pending` and
// polls. This table is what makes that honest: it records every paid reel, whether it
// rendered, and the settlement tx — so a poll can say "still rendering" vs "no such
// reel", and so reel sales are provable the same way Optic's reads are.
import { db } from "../db.js";

export type ReelStatus = "rendering" | "done" | "failed";

export interface ReelJob {
  id: string;
  agent_id: string;
  agent_name: string;
  status: ReelStatus;
  paid_tx: string | null;
  error: string | null;
  created_at: number;
}

db.exec(`CREATE TABLE IF NOT EXISTS reel_jobs (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status     TEXT NOT NULL,
  paid_tx    TEXT,
  error      TEXT,
  created_at INTEGER NOT NULL
)`);

export function createJob(id: string, agentId: string, agentName: string): void {
  db.prepare(
    "INSERT INTO reel_jobs (id, agent_id, agent_name, status, created_at) VALUES (?, ?, ?, 'rendering', ?)",
  ).run(id, agentId, agentName, Date.now());
}

export function markDone(id: string): void {
  db.prepare("UPDATE reel_jobs SET status = 'done' WHERE id = ?").run(id);
}

export function markFailed(id: string, error: string): void {
  db.prepare("UPDATE reel_jobs SET status = 'failed', error = ? WHERE id = ?").run(
    error.slice(0, 300),
    id,
  );
}

/** Called from x402 settlement when the reel's payment confirms. */
export function attachTx(id: string, tx: string): void {
  db.prepare("UPDATE reel_jobs SET paid_tx = ? WHERE id = ?").run(tx, id);
}

export function getJob(id: string): ReelJob | null {
  return (db.prepare("SELECT * FROM reel_jobs WHERE id = ?").get(id) as ReelJob) ?? null;
}
