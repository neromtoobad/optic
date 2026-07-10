import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { BudgetGuard } from "../pipeline/budget.js";

const MODEL = "claude-opus-4-8";
const INPUT_USD_PER_TOKEN = 5 / 1_000_000;
const OUTPUT_USD_PER_TOKEN = 25 / 1_000_000;

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
  timeout: 30_000,
  maxRetries: 1,
});

/**
 * Model-emitted strings occasionally carry literal control characters mid-sentence
 * (a paid Daily Alpha read produced "at 52.4%\roster cuts…" — the \r swallowed
 * characters and broke the card layout). Verdict/headline fields are single-line
 * by design, so collapse every C0 control char run to one space, recursively.
 */
function sanitizeStrings<T>(value: T): T {
  if (typeof value === "string") {
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/ {2,}/g, " ").trim() as unknown as T;
  }
  if (Array.isArray(value)) return value.map(sanitizeStrings) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeStrings(v)])) as unknown as T;
  }
  return value;
}

/**
 * Structured call: schema-constrained JSON out (output_config.format), actual
 * token cost registered with the read's budget guard.
 */
export async function structuredCall<T>(opts: {
  label: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  budget: BudgetGuard;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: {
      format: { type: "json_schema", schema: opts.schema },
      ...(opts.effort ? { effort: opts.effort } : {}),
    },
  });

  const cost =
    response.usage.input_tokens * INPUT_USD_PER_TOKEN +
    response.usage.output_tokens * OUTPUT_USD_PER_TOKEN;
  // Registered after the call (actual usage); the guard still fails the read
  // cleanly if the cap is crossed before any further external spend.
  opts.budget.register(`anthropic:${opts.label}`, cost);

  if (response.stop_reason === "refusal") {
    throw new Error(`anthropic:${opts.label} refused`);
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error(`anthropic:${opts.label} returned no text block (stop=${response.stop_reason})`);
  }
  // Sanitize model-emitted strings (stray \r/\n control chars) before they reach
  // the db, the API response, or the card renderer.
  return sanitizeStrings(JSON.parse(text.text)) as T;
}

