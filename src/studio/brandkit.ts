// STUDIO /v1/brandkit — palette / type / mark / motion tokens.
//
// Two honest sources, clearly labeled in the output:
//  - an OKX.AI agent id → deterministic palette read from the agent's OWN avatar
//    (same extractor the reel uses), name/vibe from their own listing copy
//  - free-text brand description → Claude proposes the tokens (schema-constrained)
// Type pairings come from a curated table we actually ship fonts for — the kit never
// recommends a font it hasn't seen render.
import { structuredCall } from "../lib/anthropic.js";
import type { BudgetGuard } from "../pipeline/budget.js";
import { normalizeAgentId, fetchAgentBrief } from "../reel/agent.js";
import { paletteFromAvatar, DEFAULT_PALETTE, type Palette } from "../reel/palette.js";
import { isCliEntry } from "../fixtures.js";

export interface BrandKit {
  name: string;
  source: "agent_avatar" | "described";
  palette: Palette;
  type: { display: string; mono: string; pairing_note: string };
  mark: { concept: string };
  motion: { beat_ms: number; ease: string; note: string };
  generated_at: string;
}

const TYPE_PAIRINGS: Record<string, { display: string; mono: string; pairing_note: string }> = {
  technical: { display: "Space Grotesk", mono: "IBM Plex Mono", pairing_note: "Geometric display over engineering mono — data products, terminals, anything that quotes numbers." },
  editorial: { display: "Fraunces", mono: "IBM Plex Mono", pairing_note: "High-contrast serif display with a working mono — research desks, longform, opinionated brands." },
  playful: { display: "Clash Display", mono: "Space Mono", pairing_note: "Rounded confident display with a quirky mono — consumer, social, anything that ships stickers." },
  institutional: { display: "Inter", mono: "IBM Plex Mono", pairing_note: "Neutral grotesk with a compliance-grade mono — custody, security, brands that must read calm." },
};

const KIT_SCHEMA = {
  type: "object",
  properties: {
    accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    accent2: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    label: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    ink: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    vibe: { type: "string", enum: Object.keys(TYPE_PAIRINGS) },
    mark_concept: { type: "string", maxLength: 220 },
    beat_ms: { type: "integer", description: "motion beat in ms, 120–900" },
  },
  required: ["accent", "accent2", "label", "ink", "vibe", "mark_concept", "beat_ms"],
  additionalProperties: false,
} as const;

const VIBE_SCHEMA = {
  type: "object",
  properties: {
    vibe: { type: "string", enum: Object.keys(TYPE_PAIRINGS) },
    mark_concept: { type: "string", maxLength: 220 },
    beat_ms: { type: "integer", description: "motion beat in ms, 120–900" },
  },
  required: ["vibe", "mark_concept", "beat_ms"],
  additionalProperties: false,
} as const;

// The API's structured-output schema can't carry integer bounds — clamp here instead.
const clampBeat = (n: number): number => Math.min(900, Math.max(120, Math.round(n)));

export async function makeBrandKit(query: string, budget: BudgetGuard): Promise<BrandKit | null> {
  const agentId = normalizeAgentId(query);

  if (agentId) {
    const brief = await fetchAgentBrief(agentId);
    if (!brief) return null; // unknown/under-review agent → honest 404 upstream
    const palette = await paletteFromAvatar(brief.avatar);
    const styled = await structuredCall<{ vibe: string; mark_concept: string; beat_ms: number }>({
      label: "brandkit-vibe",
      system:
        "You are a brand designer. Given an AI agent's own listing copy, pick the closest vibe, " +
        "describe ONE mark concept (a simple geometric symbol a designer could draw from your sentence — " +
        "derived from what the listing says the agent does, nothing invented), and a motion beat in ms " +
        "(fast for trading tools, slower for wellness/editorial).",
      user: JSON.stringify({ name: brief.name, description: brief.description.slice(0, 1200) }),
      schema: VIBE_SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 400,
      effort: "low",
    });
    const type = TYPE_PAIRINGS[styled.vibe] ?? TYPE_PAIRINGS.technical;
    return {
      name: brief.name,
      source: "agent_avatar",
      palette,
      type,
      mark: { concept: styled.mark_concept },
      motion: { beat_ms: clampBeat(styled.beat_ms), ease: "cubic-bezier(0.22, 1, 0.36, 1)", note: "one ease everywhere; the beat is the brand" },
      generated_at: new Date().toISOString(),
    };
  }

  // Described brand — Claude proposes, the schema constrains, we label the source.
  const kit = await structuredCall<{
    accent: string; accent2: string; label: string; ink: string; vibe: string; mark_concept: string; beat_ms: number;
  }>({
    label: "brandkit-described",
    system:
      "You are a brand designer producing tokens for a dark-UI product. accent = the brand colour; " +
      "accent2 = a lighter sibling; label = a bright desaturated tint readable at 12px on near-black; " +
      "ink = a near-black ground tinted by the accent hue. Pick the closest vibe, one drawable geometric " +
      "mark concept, and a motion beat in ms.",
    user: query.slice(0, 800),
    schema: KIT_SCHEMA as unknown as Record<string, unknown>,
    budget,
    maxTokens: 500,
    effort: "low",
  });
  const type = TYPE_PAIRINGS[kit.vibe] ?? TYPE_PAIRINGS.technical;
  return {
    name: query.slice(0, 60),
    source: "described",
    palette: { accent: kit.accent, accent2: kit.accent2, label: kit.label, ink: kit.ink } as Palette,
    type,
    mark: { concept: kit.mark_concept },
    motion: { beat_ms: clampBeat(kit.beat_ms), ease: "cubic-bezier(0.22, 1, 0.36, 1)", note: "one ease everywhere; the beat is the brand" },
    generated_at: new Date().toISOString(),
  };
}

export { DEFAULT_PALETTE };

if (isCliEntry(import.meta.url)) {
  const { BudgetGuard } = await import("../pipeline/budget.js");
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error('usage: npm run brandkit -- <agent id | "brand description">');
    process.exit(1);
  }
  const budget = new BudgetGuard();
  console.log(JSON.stringify(await makeBrandKit(query, budget), null, 2));
  console.error(`cost: $${budget.total().toFixed(4)}`);
}
