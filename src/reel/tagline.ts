// The reel's one line.
//
// Listing descriptions are long, keyword-stuffed and often machine-translated — nobody
// reads 400 words on a 3-second beat. This compresses the agent's OWN description into
// one spoken-weight line.
//
// Hard rule, same spine as Optic: the line may only restate what the listing already
// claims. No invented capabilities, no numbers we weren't given, no superlatives the
// owner didn't write. We are selling someone else's product back to them — inventing a
// feature would put words in their mouth on their own marketing asset.
import { structuredCall } from "../lib/anthropic.js";
import type { BudgetGuard } from "../pipeline/budget.js";
import type { AgentBrief } from "./agent.js";

const SCHEMA = {
  type: "object",
  properties: {
    tagline: {
      type: "string",
      description:
        "One line, 6-14 words, plain English, sentence case. What this agent DOES, in the words a buyer would use. No hype adjectives, no emoji.",
    },
  },
  required: ["tagline"],
  additionalProperties: false,
} as const;

const SYSTEM =
  "You write one-line taglines for AI agents listed on a marketplace. " +
  "You are given the agent's own listing copy. Compress it into a single line that a " +
  "buyer would instantly understand. " +
  "ABSOLUTE RULE: only restate capabilities the listing already claims. Never invent a " +
  "feature, a metric, a speed, or a guarantee. If the listing is vague, stay vague — do " +
  "not fill the gap with invention. " +
  "Plain words. No marketing adjectives (revolutionary, seamless, powerful, cutting-edge, " +
  "next-gen). No emoji. Say what it does, not how amazing it is.";

/** Truncate for the prompt — listing blurbs run to thousands of chars of keyword soup. */
function brief(b: AgentBrief): string {
  const services = b.services
    .slice(0, 8)
    .map((s) => `- ${s.name} (${s.price} USDT)`)
    .join("\n");
  return [
    `NAME: ${b.name}`,
    `DESCRIPTION: ${b.description.slice(0, 1200)}`,
    services ? `SERVICES:\n${services}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Fallback when the model is unavailable: the first clause of their own blurb. */
function firstClause(b: AgentBrief): string {
  const s = b.description.split(/(?<=[.!?])\s/)[0] ?? b.name;
  return s.length > 96 ? `${s.slice(0, 93).trimEnd()}…` : s;
}

export async function writeTagline(b: AgentBrief, budget: BudgetGuard): Promise<string> {
  try {
    const out = await structuredCall<{ tagline: string }>({
      label: "reel_tagline",
      system: SYSTEM,
      user: brief(b),
      schema: SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 120,
      effort: "low",
    });
    const t = out.tagline?.trim();
    return t && t.length > 3 ? t : firstClause(b);
  } catch (err) {
    // Degrade to the agent's own first sentence rather than fail the reel — but say so.
    // A silent catch here cost us an hour: a plain 400 (schema missing
    // additionalProperties) looked exactly like "the model wrote a bad line".
    console.warn(
      `[reel] tagline model call failed for #${b.agent_id}, using first clause:`,
      (err as Error).message.slice(0, 160),
    );
    return firstClause(b);
  }
}
