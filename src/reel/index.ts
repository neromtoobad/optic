// AGENT REEL — the studio pipeline.
//
// agent id → real listing brief → palette from their own avatar → tagline from their
// own copy → rendered MP4. Everything the reel says traces to something the owner
// already published.
import { randomUUID } from "node:crypto";
import { BudgetGuard } from "../pipeline/budget.js";
import { fetchAgentBrief, normalizeAgentId, type AgentBrief } from "./agent.js";
import { paletteFromAvatar, type Palette } from "./palette.js";
import { writeTagline } from "./tagline.js";
import { briefToProps, renderReel } from "./render.js";
import { isCliEntry } from "../fixtures.js";

export interface ReelVerdict {
  query: string;
  resolved: { type: "agent"; agent_id: string; name: string } | null;
  brief: AgentBrief | null;
  tagline: string | null;
  palette: Palette | null;
  reel_url: string | null;
  reel_pending?: boolean;
  verdict_line: string;
  generated_at: string;
}

const now = () => new Date().toISOString();

/**
 * Build the creative brief (cheap, seconds) without rendering.
 * The route returns this immediately and renders the MP4 behind reel_pending.
 */
export async function planReel(
  query: string,
  budget: BudgetGuard,
): Promise<{ verdict: ReelVerdict; jobId: string | null }> {
  const id = normalizeAgentId(query);
  if (!id) {
    return {
      jobId: null,
      verdict: {
        query,
        resolved: null,
        brief: null,
        tagline: null,
        palette: null,
        reel_url: null,
        verdict_line: `"${query}" isn't an agent id — try a number like 4380, or an okx.ai/agents/… link.`,
        generated_at: now(),
      },
    };
  }

  const brief = await fetchAgentBrief(id);
  if (!brief) {
    return {
      jobId: null,
      verdict: {
        query,
        resolved: null,
        brief: null,
        tagline: null,
        palette: null,
        reel_url: null,
        verdict_line: `No listed agent found at #${id} on OKX.AI.`,
        generated_at: now(),
      },
    };
  }

  const [palette, tagline] = await Promise.all([
    paletteFromAvatar(brief.avatar),
    writeTagline(brief, budget),
  ]);

  const jobId = randomUUID();
  return {
    jobId,
    verdict: {
      query,
      resolved: { type: "agent", agent_id: brief.agent_id, name: brief.name },
      brief,
      tagline,
      palette,
      reel_url: null,
      reel_pending: true,
      verdict_line: `15-second reel for ${brief.name} (#${brief.agent_id}) — ${brief.services.length} service${brief.services.length === 1 ? "" : "s"}, styled from their own mark.`,
      generated_at: now(),
    },
  };
}

/** Render the MP4 for a planned reel. */
export async function produceReel(
  jobId: string,
  brief: AgentBrief,
  tagline: string,
  palette: Palette,
): Promise<string> {
  return renderReel({ jobId, props: briefToProps(brief, tagline, palette) });
}

// CLI: npm run reel -- 5421
if (isCliEntry(import.meta.url)) {
  const q = process.argv.slice(2).join(" ") || "4380";
  const budget = new BudgetGuard();
  (async () => {
    const t0 = Date.now();
    const { verdict, jobId } = await planReel(q, budget);
    console.log(
      JSON.stringify(
        { ...verdict, brief: verdict.brief ? { ...verdict.brief, description: "…" } : null },
        null,
        2,
      ),
    );
    if (!jobId || !verdict.brief || !verdict.tagline || !verdict.palette) return;
    console.log(`\nplan: ${((Date.now() - t0) / 1000).toFixed(1)}s — rendering…`);
    const t1 = Date.now();
    const out = await produceReel(jobId, verdict.brief, verdict.tagline, verdict.palette);
    console.log(`reel: ${out}`);
    console.log(`render: ${((Date.now() - t1) / 1000).toFixed(1)}s · cost $${budget.total().toFixed(4)}`);
  })();
}
