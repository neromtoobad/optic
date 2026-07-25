// Render the 90s Agent Reel submission demo.
//
// Beats are derived from the ACTUAL voiceover: we read the sentence-pause timings
// (measured with ffmpeg silencedetect, passed in via demo-beats.json) so the visuals
// land with the narration instead of guessing.
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ENTRY = path.join(ROOT, "reel-studio/demo-index.ts");
const PUBLIC_DIR = path.join(ROOT, "reel-studio/public");
const BEATS_FILE = path.join(ROOT, "reel-studio/demo-beats.json");
const OUT = process.argv[2] ?? path.join(ROOT, "media-kit/agent-reel-demo-90s.mp4");

const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");

if (!existsSync(BEATS_FILE)) throw new Error(`missing ${BEATS_FILE} — run the beat-timing step first`);
const inputProps = JSON.parse(readFileSync(BEATS_FILE, "utf8"));

console.log("bundling…");
const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR });

const composition = await selectComposition({ serveUrl, id: "Demo", inputProps });
console.log(`rendering ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s) → ${OUT}`);

let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: OUT,
  inputProps,
  crf: 17,
  audioBitrate: "192k",
  concurrency: 4,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100);
    if (pct >= last + 10) {
      last = pct;
      console.log(`  ${pct}%`);
    }
  },
});
console.log("done:", OUT);
