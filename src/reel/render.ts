// Server-side reel rendering.
//
// bundle() is expensive (webpack over the composition) so it runs ONCE per process and
// is memoised; renderMedia() then runs per request with the agent's brief as inputProps.
// Renders are serialised through a queue: Chromium is memory-hungry and this box also
// serves Optic's paid reads — two concurrent renders is how you turn a 15s reel into a
// 504 on an unrelated route.
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import type { AgentBrief } from "./agent.js";
import type { ReelProps } from "./props.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// reel-studio ships in the image alongside dist/ (the bundler reads .tsx source at
// runtime). From dist/reel/ that's ../../reel-studio; from src/reel/ (tsx dev) too.
const ENTRY = path.resolve(HERE, "../../reel-studio/index.ts");
// Volume-backed so served reel URLs survive a redeploy (REELS_DIR on the mount).
const OUT_DIR = path.resolve(config.reelsDir);

let bundlePromise: Promise<string> | null = null;
let browserPromise: Promise<unknown> | null = null;

/** Make sure the headless-shell binary exists (no-op once present). */
async function ensureBrowser(): Promise<void> {
  if (!browserPromise) {
    browserPromise = import("@remotion/renderer")
      .then((m) => m.ensureBrowser())
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  await browserPromise;
}

/** Bundle the composition once per process. */
async function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const { bundle } = await import("@remotion/bundler");
      return bundle({
        entryPoint: ENTRY,
        // keep the default webpack config; the composition has no special loaders
        onProgress: () => undefined,
      });
    })().catch((err) => {
      bundlePromise = null; // let a later request retry instead of poisoning the process
      throw err;
    });
  }
  return bundlePromise;
}

/** One render at a time. */
let chain: Promise<unknown> = Promise.resolve();
function serialise<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
}

export function reelPath(id: string): string | null {
  const p = path.join(OUT_DIR, `${id}.mp4`);
  return existsSync(p) ? p : null;
}

export interface RenderOpts {
  jobId: string;
  props: ReelProps;
}

/** Render a reel to data/reels/<jobId>.mp4. Resolves to the file path. */
export async function renderReel({ jobId, props }: RenderOpts): Promise<string> {
  return serialise(async () => {
    const [{ renderMedia, selectComposition }, serveUrl] = await Promise.all([
      import("@remotion/renderer"),
      getBundle(),
      ensureBrowser(), // downloads the shell if the build step somehow didn't
    ]);

    mkdirSync(OUT_DIR, { recursive: true });
    const outputLocation = path.join(OUT_DIR, `${jobId}.mp4`);

    const composition = await selectComposition({
      serveUrl,
      id: "Reel",
      inputProps: props as unknown as Record<string, unknown>,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: props as unknown as Record<string, unknown>,
      // 720p keeps a 15s reel inside the latency budget on a shared box; it is still
      // the native aspect and reads fine on X/Telegram where these get posted.
      scale: 2 / 3,
      crf: 23,
      concurrency: 2,
      chromiumOptions: { gl: "swangle" },
    });

    return outputLocation;
  });
}

/** Map a fetched brief onto the composition's props. */
export function briefToProps(
  brief: AgentBrief,
  tagline: string,
  palette: { accent: string; accent2: string; label: string; ink: string },
): ReelProps {
  return {
    agentId: brief.agent_id,
    name: brief.name,
    tagline,
    avatar: brief.avatar,
    score: brief.score,
    approvalRate: brief.approval_rate,
    sold: brief.sold,
    cheapest: brief.cheapest,
    services: brief.services.map((s) => ({ name: s.name, price: s.price })),
    ...palette,
  };
}
