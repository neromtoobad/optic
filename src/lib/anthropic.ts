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
  return JSON.parse(text.text) as T;
}
