import { randomUUID } from "node:crypto";
import type { Verdict } from "../types.js";
import { resolve } from "../lenses/resolve.js";
import { attentionLens } from "../lenses/attention.js";
import { memeLens } from "../lenses/meme.js";
import { predictionLens } from "../lenses/prediction.js";
import { computeDivergence } from "../engine/divergence.js";
import { renderCard } from "../card/render.js";
import { BudgetGuard } from "./budget.js";
import { db, insertRead, completeRead, failRead } from "../db.js";

export interface PipelineResult {
  readId: string;
  verdict: Verdict;
  costUsd: number;
}

const CARD_TIMEOUT_MS = 45_000;

/**
 * The one engine: narrative → attention → per-venue read → divergence → verdict + card.
 * Budget-capped per read; lenses may return null (absence is signal);
 * card runs in parallel and never blocks the verdict.
 */
export async function runRead(query: string, paidTx?: string): Promise<PipelineResult> {
  const readId = randomUUID();
  insertRead(readId, query);
  const budget = new BudgetGuard();

  try {
    const resolved = await resolve(query);
    // Phase 2: each lens registers real per-call costs with the budget guard.
    const [attention, meme, prediction] = await Promise.all([
      attentionLens.read(resolved),
      memeLens.read(resolved),
      predictionLens.read(resolved),
    ]);

    const { divergence, verdict_line } = await computeDivergence(resolved, attention, meme, prediction);

    const verdict: Verdict = {
      query,
      resolved,
      attention,
      venues: { meme, prediction },
      divergence,
      verdict_line,
      generated_at: new Date().toISOString(),
      card_url: null,
    };

    // Card in parallel with response assembly; if slow, ship card_pending:true.
    const card = await Promise.race([
      renderCard(readId, verdict),
      new Promise<null>((r) => setTimeout(() => r(null), CARD_TIMEOUT_MS)),
    ]);
    if (card) {
      verdict.card_url = card.card_url;
    } else {
      verdict.card_pending = true;
      verdict.card_url = null;
    }

    completeRead(readId, resolved, verdict, verdict.card_url, budget.total());
    if (paidTx) {
      db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(paidTx, readId);
    }
    return { readId, verdict, costUsd: budget.total() };
  } catch (err) {
    failRead(readId, budget.total());
    throw err;
  }
}
