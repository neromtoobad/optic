import { randomUUID } from "node:crypto";
import type { DailyVerdict, EdgeVerdict, Resolved, ScanVerdict, SmartMoneyVerdict, Verdict } from "../types.js";
import { resolve } from "../lenses/resolve.js";
import { attentionLens } from "../lenses/attention.js";
import { memeLens } from "../lenses/meme.js";
import { predictionLens } from "../lenses/prediction.js";
import { newsFor, unlockNewsFor } from "../lenses/unlocks.js";
import { researchFor } from "../lenses/research.js";
import { riskRadar } from "../lenses/risk.js";
import { narrativeTiming } from "../lenses/timing.js";
import { smartMoneyForToken, smartMoneyFlow } from "../lenses/smartmoney.js";
import { stockRead } from "../lenses/stocks.js";
import { runEdge } from "../edge/index.js";
import { runScan } from "../scan/index.js";
import { runDaily } from "../daily/index.js";
import { computeDivergence } from "../engine/divergence.js";
import { renderCard } from "../card/render.js";
import { BudgetGuard } from "./budget.js";
import { db, insertRead, completeRead, failRead } from "../db.js";

import type { RugVerdict, TimingVerdict, StockVerdict } from "../types.js";

export type ForceMode = "edge" | "daily" | "smartmoney" | "rug" | "timing" | "stocks";

export interface PipelineResult {
  readId: string;
  verdict: Verdict | ScanVerdict | DailyVerdict | EdgeVerdict | SmartMoneyVerdict | RugVerdict | TimingVerdict | StockVerdict;
  costUsd: number;
}

type AnyVerdict = { resolved: unknown; card_url: string | null; card_pending?: boolean };

/** Render a card with a bounded wait; finishes in the background past the timeout. */
async function renderCardBounded(readId: string, verdict: Parameters<typeof renderCard>[1], budget: BudgetGuard) {
  const cardPromise = renderCard(readId, verdict, budget)
    .then((card) => {
      db.prepare("UPDATE reads SET card_url = ? WHERE id = ?").run(card.card_url, readId);
      return card;
    })
    .catch((err) => {
      console.error(`card render failed for ${readId}: ${err}`);
      return null;
    });
  return Promise.race([cardPromise, new Promise<null>((r) => setTimeout(() => r(null), CARD_TIMEOUT_MS))]);
}

async function applyCard(verdict: AnyVerdict, card: { card_url: string } | null, readId: string) {
  if (card) {
    verdict.card_url = card.card_url;
  } else {
    verdict.card_pending = true;
    verdict.card_url = `${(await import("../config.js")).config.publicBaseUrl}/v1/card/${readId}`;
  }
}

function smartMoneyVerdict(query: string, flow: Awaited<ReturnType<typeof smartMoneyFlow>>): SmartMoneyVerdict {
  const list = flow ?? [];
  const top = list[0];
  return {
    query,
    resolved: { type: "smartmoney", name: "smart money" },
    flow: list,
    verdict_line: top
      ? `Smart money is loading ${top.symbol}: ${top.wallets} wallets, $${Math.round(top.buy_usd).toLocaleString()} bought at $${top.market_cap_usd ? Math.round(top.market_cap_usd / 1000) + "K" : "?"} mcap.`
      : "No clear smart-money accumulation signal right now.",
    generated_at: new Date().toISOString(),
    card_url: null,
  };
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
export async function runRead(query: string, opts: { paidTx?: string; forceMode?: ForceMode } = {}): Promise<PipelineResult> {
  const { paidTx, forceMode } = opts;
  const readId = randomUUID();
  insertRead(readId, query);
  const budget = new BudgetGuard();

  const t0 = Date.now();
  const mark = (stage: string) => console.error(`  [${readId.slice(0, 8)}] ${stage} +${((Date.now() - t0) / 1000).toFixed(1)}s`);

  try {
    // Stocks desk — OKX tokenized equity (xStock) + equity research + prediction
    // markets on the company → cross-venue read. Self-contained (no crypto resolve).
    if (forceMode === "stocks") {
      const v = await stockRead(query, budget);
      const card = await renderCardBounded(readId, v, budget);
      await applyCard(v, card, readId);
      completeRead(readId, v.resolved, v, v.card_url, budget.total());
      if (paidTx) db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(paidTx, readId);
      return { readId, verdict: v, costUsd: budget.total() };
    }
    // Dedicated-service modes force a single capability regardless of query text.
    if (forceMode === "edge" || forceMode === "daily" || forceMode === "smartmoney") {
      let v: EdgeVerdict | DailyVerdict | SmartMoneyVerdict;
      if (forceMode === "edge") v = { ...(await runEdge(budget, readId)), card_url: null };
      else if (forceMode === "daily") v = { ...(await runDaily(budget, readId)), card_url: null };
      else v = smartMoneyVerdict(query, await smartMoneyFlow("501", budget));
      const card = await renderCardBounded(readId, v, budget);
      applyCard(v, card, readId);
      completeRead(readId, v.resolved, v, v.card_url, budget.total());
      if (paidTx) db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(paidTx, readId);
      return { readId, verdict: v, costUsd: budget.total() };
    }
    if (forceMode === "rug" || forceMode === "timing") {
      const resolved = await resolve(query, budget);
      if (resolved.type !== "token") {
        const v =
          forceMode === "rug"
            ? ({ query, resolved: resolved as Resolved, risk: null, verdict_line: `${query} is not a token address or ticker — rug radar needs a token.`, generated_at: new Date().toISOString(), card_url: null } as RugVerdict)
            : ({ query, resolved: resolved as Resolved, timing: null, verdict_line: `${query} is not a token — narrative timing needs a token.`, generated_at: new Date().toISOString(), card_url: null } as TimingVerdict);
        completeRead(readId, resolved, v, null, budget.total());
        if (paidTx) db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(paidTx, readId);
        return { readId, verdict: v, costUsd: budget.total() };
      }
      let v: RugVerdict | TimingVerdict;
      if (forceMode === "rug") {
        const risk = await riskRadar(resolved, budget);
        v = {
          query,
          resolved,
          risk,
          verdict_line: risk
            ? `${resolved.name}: risk ${risk.score}/100 (${risk.level})${risk.flags[0] ? ` — ${risk.flags[0]}` : ""}`
            : `${resolved.name}: not enough onchain data for a rug read.`,
          generated_at: new Date().toISOString(),
          card_url: null,
        };
      } else {
        const timing = await narrativeTiming(resolved, budget);
        v = {
          query,
          resolved,
          timing,
          verdict_line: timing ? `${resolved.name}: ${timing.read}` : `${resolved.name}: no timing signal available.`,
          generated_at: new Date().toISOString(),
          card_url: null,
        };
      }
      completeRead(readId, resolved, v, null, budget.total());
      if (paidTx) db.prepare("UPDATE reads SET paid_tx = ? WHERE id = ?").run(paidTx, readId);
      return { readId, verdict: v, costUsd: budget.total() };
    }

    const resolved = await resolve(query, budget);
    mark("resolve");

    let verdict: Verdict | ScanVerdict | DailyVerdict | EdgeVerdict | SmartMoneyVerdict;
    if (resolved.type === "scan") {
      verdict = { ...(await runScan(budget)), card_url: null };
    } else if (resolved.type === "daily") {
      verdict = { ...(await runDaily(budget, readId)), card_url: null };
    } else if (resolved.type === "edge") {
      verdict = { ...(await runEdge(budget, readId)), card_url: null };
    } else if (resolved.type === "smartmoney") {
      const flow = (await smartMoneyFlow("501", budget)) ?? [];
      const top = flow[0];
      verdict = {
        query,
        resolved: { type: "smartmoney", name: "smart money" },
        flow,
        verdict_line: top
          ? `Smart money is loading ${top.symbol}: ${top.wallets} wallets, $${Math.round(top.buy_usd).toLocaleString()} bought at $${top.market_cap_usd ? Math.round(top.market_cap_usd / 1000) + "K" : "?"} mcap.`
          : "No clear smart-money accumulation signal right now.",
        generated_at: new Date().toISOString(),
        card_url: null,
      };
    } else {
      // Each lens registers real per-call costs with the budget guard; any lens
      // may return null and the divergence engine treats absence as signal.
      const [attention, meme, prediction, unlockNews, news, research, risk, timing, smartMoney] = await Promise.all([
        attentionLens.read(resolved, budget),
        memeLens.read(resolved, budget),
        predictionLens.read(resolved, budget),
        unlockNewsFor(resolved, budget),
        newsFor(resolved, budget),
        researchFor(resolved, budget),
        riskRadar(resolved, budget),
        narrativeTiming(resolved, budget),
        smartMoneyForToken(resolved, budget),
      ]);
      mark("lenses");

      const { divergence, verdict_line } = await computeDivergence(
        resolved,
        attention,
        meme,
        prediction,
        unlockNews,
        news,
        research,
        { risk, timing, smartMoney },
        budget
      );

      // Log surfaced prediction markets to the track record (scored on resolution).
      if (prediction?.markets?.length) {
        const { logPicks } = await import("../track/picks.js");
        logPicks(
          readId,
          prediction.markets
            .filter((m) => m.url.includes("/market/"))
            .map((m) => ({
              category: "prediction" as const,
              subject: resolved.name,
              market_question: m.question,
              market_slug: m.url.split("/market/")[1] ?? "",
              yes_price: m.yes_price,
            }))
        );
      }

      verdict = {
        query,
        resolved,
        attention,
        venues: { meme, prediction, unlock_news: unlockNews, news },
        research,
        risk,
        timing,
        smart_money: smartMoney,
        divergence,
        verdict_line,
        generated_at: new Date().toISOString(),
        card_url: null,
      };
    }

    mark("verdict");

    // Card must never block the verdict: bounded wait, then background completion.
    const card = await renderCardBounded(readId, verdict, budget);
    await applyCard(verdict, card, readId);

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
