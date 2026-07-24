// STUDIO /v1/asset — text → branded hero image.
//
// Venice paints the scene from the buyer's words inside the house cinematic wrapper
// (dark, minimal, no baked-in text — AI text is unreliable, so type is composited);
// satori sets the optional title/subtitle in real fonts on top. The buyer's asset
// carries NO Optic/Reel branding — it's their image, not our ad.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { config } from "../config.js";
import type { BudgetGuard } from "../pipeline/budget.js";
import { saveAsset } from "./shared.js";
import { structuredCall } from "../lib/anthropic.js";
import { isCliEntry } from "../fixtures.js";

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    mood: { type: "string", maxLength: 60 },
    motifs: { type: "string", maxLength: 160 },
    palette: { type: "string", maxLength: 80 },
  },
  required: ["mood", "motifs", "palette"],
  additionalProperties: false,
} as const;

/**
 * Turn a buyer's description into an ABSTRACT visual brief (mood/motifs/palette only)
 * so the literal phrase never reaches the image model — which otherwise bakes the
 * marketing words into the picture as text. Falls back to a neutral brand brief.
 */
async function visualBrief(subject: string, budget: BudgetGuard): Promise<{ mood: string; motifs: string; palette: string }> {
  try {
    return await structuredCall<{ mood: string; motifs: string; palette: string }>({
      label: "asset-brief",
      system:
        "You turn a product/brand description into an ABSTRACT visual brief for a background banner. " +
        "Output ONLY visual qualities — light, shape, texture, colour, atmosphere. NEVER include any " +
        "literal words, names, brands, objects, people, or phrases from the input; the image must contain " +
        "no text and no recognizable subjects. mood: 2-4 adjectives. motifs: abstract forms/light only. " +
        "palette: 2-3 colours that suit the theme (may lean on deep charcoal, amber, teal).",
      user: subject.slice(0, 300),
      schema: BRIEF_SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 200,
      effort: "low",
    });
  } catch (err) {
    console.error(`asset brief fell back: ${err}`);
    return { mood: "calm, premium, cinematic", motifs: "flowing gradient mesh, soft volumetric light, drifting particles", palette: "deep charcoal, warm amber, cool teal" };
  }
}

const W = 1200;
const H = 675;
const VENICE_COST_USD = 0.01;

export interface AssetResult {
  asset_id: string;
  asset_url: string;
  width: number;
  height: number;
  title: string | null;
  generated_at: string;
}

const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
];

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Guarantee a visible hero: Venice output is stochastic and some scenes come back
 * near-black, which reads as a blank image. If mean luminance is below a floor, lift
 * it (linear gain + small offset) so there's always a discernible picture.
 */
async function ensureVisible(png: Buffer): Promise<Buffer> {
  try {
    const stats = await sharp(png).stats();
    const mean = stats.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
    if (mean >= 38) return png; // already legible
    const gain = Math.min(3.4, 52 / Math.max(mean, 6));
    return await sharp(png).linear(gain, 6).png().toBuffer();
  } catch {
    return png; // never fail the render over a brightness tweak
  }
}

async function veniceScene(brief: { mood: string; motifs: string; palette: string }, budget: BudgetGuard): Promise<Buffer | null> {
  if (!config.veniceApiKey) return null;
  budget.register("venice:asset", VENICE_COST_USD);
  // This is a BRANDED HEADER, not a photo — the title/subtitle are composited on top,
  // so the background must be an ABSTRACT, textless, subjectless field. We feed only the
  // abstract brief (mood/motifs/palette), never the buyer's literal phrase, so the model
  // can't bake the marketing words into the picture. Every literal subject + text is
  // hard-negatived as a second line of defence.
  const prompt =
    `Abstract premium tech brand banner. Mood: ${brief.mood}. Motifs: ${brief.motifs}. ` +
    `Palette: ${brief.palette}. Flowing gradient mesh, soft volumetric light, fine particles and gentle ` +
    `bokeh, deep charcoal ground (never pure black), cinematic, elegant, well-exposed, with calm negative ` +
    `space toward the lower-left. Purely abstract — no recognizable objects.`;
  const negative_prompt =
    "text, letters, words, writing, typography, caption, numbers, logo, watermark, signature, " +
    "person, people, human, man, woman, face, portrait, figure, silhouette, body, hands, character, " +
    "mascot, animal, product shot, object, frame, border";
  const res = await fetch("https://api.venice.ai/api/v1/image/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.veniceApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "z-image-turbo", prompt, negative_prompt, width: W, height: H, format: "png", safe_mode: true, hide_watermark: true }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    console.error(`venice asset: HTTP ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { images?: string[] };
  return json.images?.[0] ? Buffer.from(json.images[0], "base64") : null;
}

async function typeLayer(title: string, subtitle: string | null): Promise<string> {
  const tree = `<div style="display:flex;flex-direction:column;justify-content:flex-end;width:${W}px;height:${H}px;padding:64px;">
    <div style="display:flex;font-family:'Space Grotesk';font-weight:700;font-size:64px;line-height:1.05;letter-spacing:-1px;color:#f2f4f8;max-width:900px;">${esc(title)}</div>
    ${subtitle ? `<div style="display:flex;font-family:'IBM Plex Mono';font-size:20px;letter-spacing:2px;color:rgba(242,244,248,.75);margin-top:18px;max-width:860px;">${esc(subtitle)}</div>` : ""}
  </div>`;
  return satori(html(tree) as Parameters<typeof satori>[0], { width: W, height: H, fonts: FONTS });
}

/**
 * Render the hero. Venice failure degrades to a dark gradient ground — the buyer
 * always gets a usable image, never a blank error after payment.
 */
export async function makeAsset(
  opts: { query: string; title?: string; subtitle?: string },
  budget: BudgetGuard
): Promise<AssetResult> {
  const id = randomUUID();
  const brief = await visualBrief(opts.query, budget);
  const raw = await veniceScene(brief, budget).catch((err) => {
    console.error(`venice asset failed: ${err}`);
    return null;
  });
  const bg = raw ? await ensureVisible(raw) : null;

  const under =
    `<rect width="${W}" height="${H}" fill="#05070d"/>` +
    (bg
      ? `<image href="data:image/png;base64,${bg.toString("base64")}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` +
        // bottom scrim so composited type stays legible on any scene
        `<rect width="${W}" height="${H}" fill="url(#g)"/><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="rgba(5,7,13,0)"/><stop offset="100%" stop-color="rgba(5,7,13,.82)"/></linearGradient></defs>`
      : "");

  const title = opts.title?.trim() || null;
  const svg = title
    ? (await typeLayer(title, opts.subtitle?.trim() || null)).replace(/(<svg[^>]*>)/, `$1${under}`)
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${under}</svg>`;

  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  const url = saveAsset(id, "hero.png", png);
  return { asset_id: id, asset_url: url, width: W, height: H, title, generated_at: new Date().toISOString() };
}

if (isCliEntry(import.meta.url)) {
  const { BudgetGuard } = await import("../pipeline/budget.js");
  const [query, title, subtitle] = process.argv.slice(2);
  if (!query) {
    console.error('usage: npm run asset -- "<scene>" ["title"] ["subtitle"]');
    process.exit(1);
  }
  const budget = new BudgetGuard();
  console.log(JSON.stringify(await makeAsset({ query, title, subtitle }, budget), null, 2));
  console.error(`cost: $${budget.total().toFixed(4)}`);
}
