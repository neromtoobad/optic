import type { Resolved } from "../types.js";
import { loadFixture, mockDelay, isCliEntry } from "../fixtures.js";

// MOCK (Phase 1). Phase 2: Anthropic classify (token address | ticker | narrative)
// + Trenches lookup to a canonical subject.
export async function resolve(query: string): Promise<Resolved> {
  await mockDelay();
  const fixture = loadFixture<Resolved>("resolved");
  return { ...fixture, name: query.length <= 20 ? query.toUpperCase() : fixture.name };
}

if (isCliEntry(import.meta.url)) {
  const query = process.argv[2] ?? "pepe";
  resolve(query).then((r) => console.log(JSON.stringify(r, null, 2)));
}
