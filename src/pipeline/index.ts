import { randomUUID } from "node:crypto";
import type { ScanVerdict, Verdict } from "../types.js";
import { resolve } from "../lenses/resolve.js";
import { attentionLens } from "../lenses/attention.js";
import { memeLens } from "../lenses/meme.js";
import { predictionLens } from "../lenses/prediction.js";
import { newsFor, unlockNewsFor } from "../lenses/unlocks.js";
import { runScan } from "../scan/index.js";
import { computeDivergence } from "../engine/divergence.js";
import { renderCard } from "../card/render.js";
import { BudgetGuard } from "./budget.js";
import { db, insertRead, completeRead, failRead } from "../db.js";

export interface PipelineResult {
  readId: string;
  verdict: Verdict | ScanVerdict;
  costUsd: number;
}

// Max time the response waits on the card; past this the card finishes in the
// background and card_pending:true ships with a URL that will start serving.
const CARD_TIMEOUT_MS = 15_000;

/**
 * The one engine: narrative → attention → per-venue read → divergence → verdict + card.
 * A "scan" query flips to discovery mode: acceleration ranking + fresh trenches +
 * unlock calendar. Budget-capped per read; lenses may return null (absence is
 * signal); card runs in parallel and never blocks the verdict.
 */
export async function runRead(query: string, paidTx?: string): Promise<PipelineResult> {
  const readId = randomUUID();
  insertRead(readId, query);
  const budget = new BudgetGuard();

  const t0 = Date.now();
  const mark = (stage: string) => console.error(`  [${readId.slice(0, 8)}] ${stage} +${((Date.now() - t0) / 1000).toFixed(1)}s`);

  try {
    const resolved = await resolve(query, budget);
    mark("resolve");

    let verdict: Verdict | ScanVerdict;
    if (resolved.type === "scan") {
      verdict = { ...(await runScan(budget)), card_url: null };
    } else {
      // Each lens registers real per-call costs with the budget guard; any lens
      // may return null and the divergence engine treats absence as signal.
      const [attention, meme, prediction, unlockNews, news] = await Promise.all([
        attentionLens.read(resolved, budget),
        memeLens.read(resolved, budget),
        predictionLens.read(resolved, budget),
        unlockNewsFor(resolved, budget),
        newsFor(resolved, budget),
      ]);
      mark("lenses");

      const { divergence, verdict_line } = await computeDivergence(
        resolved,
        attention,
        meme,
        prediction,
        unlockNews,
        news,
        budget
      );

      verdict = {
        query,
        resolved,
        attention,
        venues: { meme, prediction, unlock_news: unlockNews, news },
        divergence,
        verdict_line,
        generated_at: new Date().toISOString(),
        card_url: null,
      };
    }

    mark("verdict");

    // Card must never block the verdict: give it a short window, then ship
    // card_pending and let the render finish in the background — GET /v1/card/:id
    // serves the PNG the moment it lands on disk.
    const cardPromise = renderCard(readId, verdict, budget)
      .then((card) => {
        db.prepare("UPDATE reads SET card_url = ? WHERE id = ?").run(card.card_url, readId);
        mark("card done");
        return card;
      })
      .catch((err) => {
        console.error(`card render failed for ${readId}: ${err}`);
        return null;
      });
    const card = await Promise.race([
      cardPromise,
      new Promise<null>((r) => setTimeout(() => r(null), CARD_TIMEOUT_MS)),
    ]);
    if (card) {
      verdict.card_url = card.card_url;
    } else {
      verdict.card_pending = true;
      verdict.card_url = `${(await import("../config.js")).config.publicBaseUrl}/v1/card/${readId}`;
    }

    completeRead(readId, verdict.resolved, verdict, verdict.card_url, budget.total());
    if (paidTx) {
      db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(paidTx, readId);
    }
    return { readId, verdict, costUsd: budget.total() };
  } catch (err) {
    failRead(readId, budget.total());
    throw err;
  }
}
