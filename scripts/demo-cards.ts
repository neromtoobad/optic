import { runRead, type ForceMode } from "../src/pipeline/index.js";
import { cardPath } from "../src/card/render.js";
import { copyFileSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// Generate one demo card per marketplace service from live data.
const DEMO = "fixtures/cards/demo";
mkdirSync(DEMO, { recursive: true });

const jobs: Array<{ name: string; query: string; mode?: ForceMode }> = [
  { name: "read", query: "pepe" },
  { name: "edge", query: "edge", mode: "edge" },
  { name: "daily", query: "daily", mode: "daily" },
  { name: "smart", query: "smartmoney", mode: "smartmoney" },
  { name: "rug", query: "6g2ifQHewJ3CgD3ysAhcm9J6z4TtXYdRQ3S5Xx4vpump", mode: "rug" },
  { name: "timing", query: "pepe", mode: "timing" },
  { name: "stocks", query: "NVDA", mode: "stocks" },
];

for (const j of jobs) {
  console.log(`\n=== ${j.name} (${j.query}) ===`);
  try {
    const { readId, verdict } = await runRead(j.query, j.mode ? { forceMode: j.mode } : {});
    console.log("verdict:", ((verdict as { verdict_line?: string }).verdict_line ?? "").slice(0, 110));
    let p: string | null = null;
    for (let i = 0; i < 30; i++) {
      p = cardPath(readId);
      if (p) break;
      await sleep(1000);
    }
    if (p) {
      copyFileSync(p, `${DEMO}/${j.name}.png`);
      console.log("saved:", `${DEMO}/${j.name}.png`);
    } else {
      console.log("NO CARD for", j.name);
    }
  } catch (e) {
    console.log("FAILED", j.name, String(e).slice(0, 200));
  }
}
console.log("\ndone");
process.exit(0);
