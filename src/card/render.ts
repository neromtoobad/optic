import { readFileSync } from "node:fs";
import type { ScanVerdict, Verdict } from "../types.js";
import { mockDelay, isCliEntry } from "../fixtures.js";
import { config } from "../config.js";

export interface CardResult {
  card_url: string;
  pending: boolean;
}

// MOCK (Phase 1). Phase 3: Venice background in the locked style + composited
// text/stats (satori or node-canvas), 1200x675 PNG, saved to the volume.
// Runs in parallel with verdict assembly; card never blocks the verdict.
export async function renderCard(readId: string, _verdict: Verdict | ScanVerdict): Promise<CardResult> {
  await mockDelay();
  return { card_url: `${config.publicBaseUrl}/v1/card/${readId}`, pending: false };
}

if (isCliEntry(import.meta.url)) {
  const path = process.argv[2] ?? "./fixtures/verdict.json";
  const verdict = JSON.parse(readFileSync(path, "utf8")) as Verdict;
  renderCard("cli-test", verdict).then((r) => console.log(JSON.stringify(r, null, 2)));
}
