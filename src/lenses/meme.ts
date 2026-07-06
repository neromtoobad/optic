import type { Lens, MemeVenue, Resolved } from "../types.js";
import { loadFixture, mockDelay, isCliEntry } from "../fixtures.js";

// MOCK (Phase 1). Phase 2: OKX Trenches (details, dev info, similar tokens)
// + Token/Price API. Cached 10m, cost registered with budget guard.
export const memeLens: Lens<MemeVenue> = {
  name: "meme",
  async read(_resolved: Resolved): Promise<MemeVenue | null> {
    await mockDelay();
    return loadFixture<MemeVenue>("meme");
  },
};

if (isCliEntry(import.meta.url)) {
  const address = process.argv[2] ?? "MoCK1111111111111111111111111111111111111111";
  memeLens
    .read({ type: "token", name: "cli", address })
    .then((r) => console.log(JSON.stringify(r, null, 2)));
}
