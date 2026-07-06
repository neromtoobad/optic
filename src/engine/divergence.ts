import type { Attention, Divergence, MemeVenue, PredictionVenue, Research, Resolved, UnlockNews } from "../types.js";
import { structuredCall } from "../lib/anthropic.js";
import { lintVerdictStrings } from "../lint.js";
import type { BudgetGuard } from "../pipeline/budget.js";

export interface DivergenceResult {
  divergence: Divergence;
  verdict_line: string;
}

const DIVERGENCE_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description:
        "Divergence 0-100. Rubric: 0-20 venues aligned; 21-50 mild lag between venues; 51-80 clear divergence; 81-100 extreme disconnect. Judge how differently the venues price the SAME story.",
    },
    direction: {
      type: "string",
      enum: [
        "aligned",
        "attention_ahead_of_venues",
        "venues_ahead_of_attention",
        "meme_ahead_of_prediction",
        "prediction_ahead_of_meme",
      ],
    },
    one_liner: {
      type: "string",
      description: "One sentence citing the single strongest concrete fact behind the score.",
    },
    reasoning: {
      type: "array",
      items: { type: "string" },
      description: "2-4 short observations comparing the venue reads. Each cites data present in the input.",
    },
    verdict_line: {
      type: "string",
      description: "The shareable headline read, <= 140 chars, observational.",
    },
  },
  required: ["score", "direction", "one_liner", "reasoning", "verdict_line"],
  additionalProperties: false,
} as const;

const SYSTEM = `You are OPTIC's divergence engine. You compare how three venues price the same story:
- ATTENTION (social): hotness score 0-100, trend, mentions, sentiment, KOLs
- MEME venue (onchain): price, 24h change, liquidity, holders, dev/holder-concentration flags
- PREDICTION venue (outcome markets): related markets with yes-prices, 24h odds movement (yes_chg_24h), and volume
- UNLOCK NEWS (supply events): news items about scheduled unlocks/vesting for this token — report dates and sizes as facts; scheduled supply expansion is context the other venues may or may not be pricing
- NEWS (research headlines for narratives): the reported facts behind the story — compare what the news says against what the odds price; a market whose odds moved against fresh news IS a divergence
- RESEARCH (web-sourced context — the value-add): recent form, injuries, roster/lineup news, weather, catalysts for the subject. This is the WHY behind the market read. When research is present, your job is to EXPLAIN the odds with it and flag where the research adds nuance the raw number misses (e.g. "favourite is missing two starters — the underdog price may be softer than it looks"). Cite specific researched facts. This is what makes the read worth paying for — do not ignore it when present.

Rules — non-negotiable:
- Divergence between venues IS the signal. Score it with the rubric in the schema.
- When research is present, the verdict_line and reasoning should lead with the substantive read (favourite + the key research factor), not just the divergence score.
- A null venue is itself signal: no prediction market pricing a hot story means attention is unhedged; say so.
- NEVER invent data. Every claim cites a number present in the input.
- Report the map, never a trade instruction. Observational language only: priced-in, lagging, diverging, crowded, asleep, unhedged.
- BANNED words (will fail lint): buy, sell, long, short, ape, moon. Also no action/advice verbs of any kind: accumulate, exit, exploit, fade, play, enter, bet.
- Numbers: round sensibly; percentages with one decimal at most.`;

// DIVERGENCE engine — the one comparison at the heart of OPTIC.
export async function computeDivergence(
  resolved: Resolved,
  attention: Attention | null,
  meme: MemeVenue | null,
  prediction: PredictionVenue | null,
  unlockNews: UnlockNews[] | null,
  news: UnlockNews[] | null,
  research: Research | null,
  budget: BudgetGuard
): Promise<DivergenceResult> {
  const input = JSON.stringify({
    subject: resolved,
    attention,
    venues: { meme, prediction, unlock_news: unlockNews, news },
    research: research?.brief ?? null,
  });

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await structuredCall<Divergence & { verdict_line: string }>({
      label: attempt === 0 ? "divergence" : "divergence_retry",
      system: SYSTEM,
      user: input + feedback,
      schema: DIVERGENCE_SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 700,
    });

    const { verdict_line, ...divergence } = out;
    const lint = lintVerdictStrings([verdict_line, divergence.one_liner, ...divergence.reasoning]);
    if (lint.ok) {
      return { divergence, verdict_line };
    }
    feedback = `\n\nYour previous output failed the language lint on: ${JSON.stringify(lint.violations.map((v) => v.word))}. Rewrite without those words.`;
  }
  throw new Error("divergence output failed banned-word lint after retry");
}
