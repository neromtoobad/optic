import type { Attention, Divergence, MemeVenue, PredictionVenue, Resolved } from "../types.js";
import { loadFixture, mockDelay } from "../fixtures.js";
import { lintVerdictStrings } from "../lint.js";

export interface DivergenceResult {
  divergence: Divergence;
  verdict_line: string;
}

// MOCK (Phase 1). Phase 2: Anthropic call with strict JSON schema comparing
// venue reads. Nulls are signal ("attention is unhedged"). Observational
// language only — output must pass the banned-word lint.
export async function computeDivergence(
  _resolved: Resolved,
  _attention: Attention | null,
  _meme: MemeVenue | null,
  _prediction: PredictionVenue | null
): Promise<DivergenceResult> {
  await mockDelay();
  const v = loadFixture<{ divergence: Divergence; verdict_line: string }>("verdict");
  const result = { divergence: v.divergence, verdict_line: v.verdict_line };

  const lint = lintVerdictStrings([result.verdict_line, result.divergence.one_liner, ...result.divergence.reasoning]);
  if (!lint.ok) {
    throw new Error(`divergence output failed banned-word lint: ${JSON.stringify(lint.violations)}`);
  }
  return result;
}
