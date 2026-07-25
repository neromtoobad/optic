// STUDIO /v1/asset — text → branded hero image (a header, not a photo).
//
// Hard requirements this file exists to guarantee, because a buyer pays per call:
//  1. The image is ALWAYS a real branded banner. If every image model is down we
//     render a procedural gradient-mesh header in code — never a blank rectangle.
//  2. It is RELATED to the subject. An agent id pulls that agent's own brief and
//     avatar palette; free text drives mood/motifs. The fallback stays subject-aware.
//  3. The type is ALWAYS set. If the caller sends no title we derive one (the agent's
//     name, or a short title from their words) — the service promises title + subtitle.
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
import { normalizeAgentId, fetchAgentBrief } from "../reel/agent.js";
import { paletteFromAvatar, DEFAULT_PALETTE, type Palette } from "../reel/palette.js";
import { isCliEntry } from "../fixtures.js";

const W = 1200;
const H = 675;
const VENICE_COST_USD = 0.01;

// One overloaded model must never blank a paid asset — try in order, short leash each.
const IMAGE_MODELS = ["z-image-turbo", "qwen-image-2", "seedream-v5-lite"];
const PER_MODEL_TIMEOUT_MS = 38_000;

export interface AssetResult {
  asset_id: string;
  asset_url: string;
  width: number;
  height: number;
  title: string | null;
  subtitle: string | null;
  subject: string;
  /** "model" when an image model painted it, "procedural" when rendered in code. */
  background: "model" | "procedural";
  generated_at: string;
}

const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
];

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const trunc = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

// ── subject resolution ────────────────────────────────────────────────────

interface Subject {
  /** Agent/brand name when we know it (agent id input), else null. */
  name: string | null;
  /** The words that describe what this is — drives the art direction. */
  description: string;
  avatar: string | null;
  agentId: string | null;
}

async function resolveSubject(query: string): Promise<Subject> {
  const id = normalizeAgentId(query);
  if (id) {
    const brief = await fetchAgentBrief(id).catch(() => null);
    if (brief) {
      return { name: brief.name, description: brief.description || brief.name, avatar: brief.avatar, agentId: brief.agent_id };
    }
  }
  return { name: null, description: query, avatar: null, agentId: null };
}

// ── art direction ─────────────────────────────────────────────────────────

const BRIEF_SCHEMA = {
  type: "object",
  properties: { brief: { type: "string", maxLength: 240 } },
  required: ["brief"],
  additionalProperties: false,
} as const;

/**
 * Abstract art direction for the banner. A SINGLE string field — multi-field JSON
 * is unreliable on small models, and this path is the proven-robust one. The literal
 * subject text never reaches the image model (it bakes the words into the picture);
 * only this abstract line does.
 */
async function artDirection(subject: Subject, budget: BudgetGuard): Promise<string> {
  try {
    const out = await structuredCall<{ brief: string }>({
      label: "asset-brief",
      system:
        "You are an art director. Given what a product does, reply with ONE line of abstract art " +
        "direction for a background banner: 2-3 mood adjectives, then abstract forms/light that EVOKE " +
        "that product's world (e.g. security -> interlocking geometric shields; markets -> flowing ribbons " +
        "of light; wellness -> soft organic curves), then 2-3 colours. Never name the product, never " +
        "include words/letters, people, faces, or literal recognisable objects.",
      user: subject.description.slice(0, 400),
      schema: BRIEF_SCHEMA as unknown as Record<string, unknown>,
      budget,
      maxTokens: 160,
      effort: "low",
    });
    if (out.brief && out.brief.trim().length > 12) return out.brief.trim();
  } catch (err) {
    console.error(`asset art direction fell back: ${err}`);
  }
  return fallbackDirection(subject.description);
}

/**
 * Subject-aware fallback — used when the model is unavailable. Keyword→motif so the
 * art still relates to the buyer's world instead of a generic gradient.
 */
const MOTIFS: Array<[RegExp, string]> = [
  [/secur|audit|guard|risk|shield|safe|protect/i, "interlocking geometric shield forms, hexagonal lattice light, cool teal and steel blue"],
  [/trade|market|price|alpha|defi|yield|liquid|swap|arb/i, "flowing ribbons of light like layered market curves, fine data filaments, amber and cyan"],
  [/predict|odds|bet|forecast|signal/i, "diverging light paths splitting from one point, probability haze, amber and violet"],
  [/health|wellness|fitness|diet|food|calm|sleep/i, "soft organic curves, gentle dawn glow, sage green and warm sand"],
  [/travel|flight|itinerary|city|map|route/i, "long horizon light, arcing route lines, dusk blue and warm gold"],
  [/art|design|brand|creative|studio|video|image/i, "sweeping brushed light strokes, prismatic bloom, amber and magenta"],
  [/data|analytic|chain|index|node|api|infra/i, "luminous node lattice, depth-of-field particles, deep blue and teal"],
  [/social|community|kol|chat|network/i, "converging light threads forming a soft web, warm amber and rose"],
  [/nft|mint|collect|token/i, "faceted crystalline planes catching light, iridescent teal and gold"],
];

function fallbackDirection(description: string): string {
  const hit = MOTIFS.find(([re]) => re.test(description));
  const motif = hit ? hit[1] : "flowing gradient mesh, drifting light particles, deep charcoal with amber and teal";
  return `calm, premium, cinematic; ${motif}`;
}

// ── background: image model, then procedural ──────────────────────────────

async function modelBackground(direction: string, budget: BudgetGuard): Promise<Buffer | null> {
  if (!config.veniceApiKey) return null;
  const prompt =
    `Abstract premium brand banner. ${direction}. Flowing gradient mesh, soft volumetric light, ` +
    `fine particles, deep charcoal ground (never pure black), cinematic, elegant, well-exposed, ` +
    `calm negative space toward the lower-left. Purely abstract — no recognisable objects.`;
  const negative =
    "text, letters, words, writing, typography, caption, numbers, logo, watermark, signature, " +
    "person, people, human, face, portrait, figure, silhouette, body, hands, character, mascot, animal, object";

  for (const model of IMAGE_MODELS) {
    try {
      const res = await fetch("https://api.venice.ai/api/v1/image/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.veniceApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          negative_prompt: negative,
          width: W,
          height: H,
          format: "png",
          safe_mode: true,
          hide_watermark: true,
        }),
        signal: AbortSignal.timeout(PER_MODEL_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`asset bg: ${model} HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { images?: string[] };
      const b64 = json.images?.[0];
      if (!b64) {
        console.error(`asset bg: ${model} returned no image`);
        continue;
      }
      // Charge for the image ONLY when one actually came back.
      budget.register("venice:asset", VENICE_COST_USD);
      return Buffer.from(b64, "base64");
    } catch (err) {
      console.error(`asset bg: ${model} failed — ${err instanceof Error ? err.message : err}`);
    }
  }
  return null;
}

/**
 * Procedural fallback — a real gradient-mesh header rendered from the palette with
 * resvg. Costs nothing, never fails, and stays on-brand, so a paid call always
 * returns a usable banner even with every image model down.
 */
function proceduralBackground(p: Palette): Buffer {
  const blob = (cx: number, cy: number, r: number, color: string, op: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}" filter="url(#soft)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="120"/>
      </filter>
      <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${p.ink}"/><stop offset="100%" stop-color="#0b0f18"/>
      </linearGradient>
      <radialGradient id="vig" cx="50%" cy="46%" r="72%">
        <stop offset="55%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.72)"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#ground)"/>
    ${blob(W * 0.74, H * 0.2, 260, p.accent, 0.5)}
    ${blob(W * 0.9, H * 0.72, 220, p.accent2, 0.34)}
    ${blob(W * 0.36, H * 0.52, 240, p.accent, 0.2)}
    ${blob(W * 0.12, H * 0.16, 180, p.label, 0.14)}
    <g opacity="0.1" stroke="#ffffff" stroke-width="1">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${(i + 1) * (H / 10)}" x2="${W}" y2="${(i + 1) * (H / 10)}"/>`).join("")}
      ${Array.from({ length: 15 }, (_, i) => `<line x1="${(i + 1) * (W / 16)}" y1="0" x2="${(i + 1) * (W / 16)}" y2="${H}"/>`).join("")}
    </g>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}

/** Lift a too-dark model image so a paid hero is never an unreadable near-black frame. */
async function ensureVisible(png: Buffer): Promise<Buffer> {
  try {
    const stats = await sharp(png).stats();
    const mean = stats.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
    if (mean >= 38) return png;
    const gain = Math.min(3.4, 52 / Math.max(mean, 6));
    return await sharp(png).linear(gain, 6).png().toBuffer();
  } catch {
    return png;
  }
}

// ── type ──────────────────────────────────────────────────────────────────

const LINE_SCHEMA = (max: number) =>
  ({ type: "object", properties: { line: { type: "string", maxLength: max } }, required: ["line"], additionalProperties: false }) as const;

/** One short line from the model (single-string path = the reliable one). */
async function line(label: string, system: string, user: string, max: number, budget: BudgetGuard): Promise<string | null> {
  try {
    const out = await structuredCall<{ line: string }>({
      label,
      system,
      user,
      schema: LINE_SCHEMA(max) as unknown as Record<string, unknown>,
      budget,
      maxTokens: 90,
      effort: "low",
    });
    const s = out.line?.trim().replace(/^["'`]+|["'`.]+$/g, "").trim();
    return s && s.length > 1 ? s : null;
  } catch (err) {
    console.error(`asset ${label} fell back: ${err}`);
    return null;
  }
}

/** Small models sometimes echo the instruction ("…4 words)"). Never ship that. */
const INSTRUCTION_LEAK = /\b(words?|characters?|reply|output|headline|strapline|title case|lowercase|max)\b|[():]|^\d/i;
// Trailing words that mean the phrase was cut off mid-thought ("…In Every").
const DANGLING =
  /\b(a|an|the|to|of|and|or|for|with|in|on|at|by|from|before|after|your|you|it|is|are|that|this|every|each|all|more|one|own|its|their|our|my|any|some|most|very|just)$/i;

function usableLine(s: string | null, opts: { maxWords: number; minWords: number }): string | null {
  if (!s) return null;
  const clean = s.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  if (words.length > opts.maxWords) return null;
  if (INSTRUCTION_LEAK.test(clean)) return null;
  if (!/[a-z]/i.test(clean)) return null;
  // trim a dangling connective so the line reads finished
  while (words.length > opts.minWords && DANGLING.test(words[words.length - 1])) words.pop();
  // still dangling, or too short to be a real line → reject, use the offline path
  if (words.length < opts.minWords || DANGLING.test(words[words.length - 1])) return null;
  const out = words.join(" ").replace(/[,;:—-]+$/, "").trim();
  return out.length > 1 ? out : null;
}

/** Offline title: first few words, trimmed so it never ends mid-thought. */
function offlineTitle(subject: Subject): string {
  if (subject.name) return trunc(subject.name, 42);
  const first = (subject.description.split(/[.!?\n]/)[0] ?? "").trim();
  const words = first.split(/\s+/).filter(Boolean).slice(0, 5);
  while (words.length > 2 && DANGLING.test(words[words.length - 1])) words.pop();
  const t = words.join(" ").replace(/[,;:—-]+$/, "") || "Untitled";
  return trunc(t.charAt(0).toUpperCase() + t.slice(1), 42);
}

/** Derive a headline when the caller didn't send one — the service promises type. */
async function deriveTitle(subject: Subject, budget: BudgetGuard): Promise<string> {
  if (subject.name) return trunc(subject.name, 42);
  const t = await line(
    "asset-title",
    "You write short hero-image headlines. Give a punchy brand headline in title case — a few words only, " +
      "never a full sentence, no quotes, no punctuation at the end.",
    subject.description.slice(0, 300),
    46,
    budget
  );
  return trunc(usableLine(t, { maxWords: 6, minWords: 2 }) ?? offlineTitle(subject), 46);
}

/** Derive the strapline under the headline; never a duplicate of the title. */
async function deriveSubtitle(subject: Subject, title: string, budget: BudgetGuard): Promise<string | null> {
  const raw = await line(
    "asset-subtitle",
    "You write the strapline under a hero headline. Give one short lowercase phrase that says what it does — " +
      "concrete, complete, no quotes, no period at the end. Do not repeat the headline.",
    `Headline: ${title}\nWhat it does: ${subject.description.slice(0, 300)}`,
    76,
    budget
  );
  const s = usableLine(raw, { maxWords: 10, minWords: 4 });
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (s && norm(s) !== norm(title) && !norm(s).startsWith(norm(title))) return trunc(s.toLowerCase(), 76);
  // offline: a clause that isn't just the title again
  const first = (subject.description.split(/[.!?\n]/).map((x) => x.trim()).filter(Boolean)[0] ?? "").trim();
  if (!first || norm(first).startsWith(norm(title))) {
    const rest = first.slice(title.length).replace(/^[\s:—-]+/, "");
    return rest ? trunc(rest.toLowerCase(), 76) : null;
  }
  return trunc(first.toLowerCase(), 76);
}

async function typeLayer(title: string, subtitle: string | null): Promise<string> {
  const tree = `<div style="display:flex;flex-direction:column;justify-content:flex-end;width:${W}px;height:${H}px;padding:64px;">
    <div style="display:flex;font-family:'Space Grotesk';font-weight:700;font-size:${title.length > 24 ? 54 : 64}px;line-height:1.05;letter-spacing:-1px;color:#f2f4f8;max-width:940px;">${esc(title)}</div>
    ${subtitle ? `<div style="display:flex;font-family:'IBM Plex Mono';font-size:20px;letter-spacing:2px;color:rgba(242,244,248,.78);margin-top:18px;max-width:880px;">${esc(subtitle)}</div>` : ""}
  </div>`;
  return satori(html(tree) as Parameters<typeof satori>[0], { width: W, height: H, fonts: FONTS });
}

// ── the service ───────────────────────────────────────────────────────────

export async function makeAsset(
  opts: { query: string; title?: string; subtitle?: string },
  budget: BudgetGuard
): Promise<AssetResult> {
  const id = randomUUID();
  const subject = await resolveSubject(opts.query);

  // Palette: an agent's OWN avatar when we have it — that is what makes the header
  // feel like theirs rather than a stock gradient.
  const palette = subject.avatar ? await paletteFromAvatar(subject.avatar) : DEFAULT_PALETTE;

  const direction = await artDirection(subject, budget);
  const raw = await modelBackground(direction, budget);
  const background: "model" | "procedural" = raw ? "model" : "procedural";
  const bg = raw ? await ensureVisible(raw) : proceduralBackground(palette);
  if (!raw) console.error(`asset ${id}: all image models unavailable — procedural background`);

  const title = (opts.title?.trim() || (await deriveTitle(subject, budget))).slice(0, 120);
  const subtitle =
    (opts.subtitle?.trim() || (await deriveSubtitle(subject, title, budget)) || "").slice(0, 200) || null;

  const under =
    `<image href="data:image/png;base64,${bg.toString("base64")}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` +
    // scrim so composited type stays legible on any art
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="48%" stop-color="rgba(5,7,13,0)"/><stop offset="100%" stop-color="rgba(5,7,13,.86)"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>`;

  const svg = (await typeLayer(title, subtitle)).replace(/(<svg[^>]*>)/, `$1${under}`);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  const url = saveAsset(id, "hero.png", png);

  return {
    asset_id: id,
    asset_url: url,
    width: W,
    height: H,
    title,
    subtitle,
    subject: subject.name ?? trunc(subject.description, 80),
    background,
    generated_at: new Date().toISOString(),
  };
}

if (isCliEntry(import.meta.url)) {
  const { BudgetGuard } = await import("../pipeline/budget.js");
  const [query, title, subtitle] = process.argv.slice(2);
  if (!query) {
    console.error('usage: npm run asset -- "<agent id | scene/brand description>" ["title"] ["subtitle"]');
    process.exit(1);
  }
  const budget = new BudgetGuard();
  console.log(JSON.stringify(await makeAsset({ query, title, subtitle }, budget), null, 2));
  console.error(`cost: $${budget.total().toFixed(4)}`);
}
