import type { Attention, Lens, Resolved } from "../types.js";
import { loadFixture, mockDelay, isCliEntry } from "../fixtures.js";

// MOCK (Phase 1). Phase 2: OKX Social Analytics — sentiment metrics,
// vibe timeline (hotness), top KOLs. Cached 10m, cost registered with budget guard.
export const attentionLens: Lens<Attention> = {
  name: "attention",
  async read(_resolved: Resolved): Promise<Attention | null> {
    await mockDelay();
    return loadFixture<Attention>("attention");
  },
};

if (isCliEntry(import.meta.url)) {
  const query = process.argv[2] ?? "pepe";
  attentionLens
    .read({ type: "token", name: query })
    .then((r) => console.log(JSON.stringify(r, null, 2)));
}
