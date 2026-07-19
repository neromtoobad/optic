// Derive a brand palette from the agent's own avatar.
//
// Why: a reel that renders in Optic's amber makes every agent look like Optic. The
// buyer's own mark is the only brand signal we're guaranteed to have, so we read the
// palette out of it. PixelBrief is blue; PixelBrief's reel should be blue.
//
// Method: downscale to 48x48 (kills JPEG noise and makes this ~1ms), drop pixels that
// are transparent, near-black, near-white or unsaturated (logo backgrounds and text),
// then bucket the survivors by hue and take the heaviest bucket weighted by saturation
// — dominant-by-count alone picks muddy mid-tones, weighting by saturation picks the
// colour a human would call "the brand colour".
import sharp from "sharp";
import type { OutputInfo } from "sharp";

export interface Palette {
  accent: string; // the agent's colour — headings, avatar glow
  accent2: string; // lighter, for prices/secondary
  label: string; // brightest tint, for small mono labels on near-black
  ink: string; // near-black ground, tinted by the hue
}

/** Optic's own palette — the fallback when an avatar is missing or monochrome. */
export const DEFAULT_PALETTE: Palette = {
  accent: "#f5a623",
  accent2: "#ffc65c",
  label: "#ffdca0",
  ink: "#04060b",
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

function hslToHex(h: number, s: number, l: number): string {
  return `#${hslToRgb(h, s, l)
    .map((v) =>
      Math.round(255 * v)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG relative luminance — what the eye actually reads as "bright". */
function luminance(h: number, s: number, l: number): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hslToRgb(h, s, l);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Raise HSL lightness until the colour reaches a real perceptual brightness.
 *
 * Clamping HSL lightness alone is a trap: blue contributes ~7% of luminance and green
 * ~72%, so a "50% lightness" blue reads about a third as bright as a 50% amber. Small
 * mono labels on near-black vanish. We solve for luminance instead of trusting L.
 */
function liftToLuminance(h: number, s: number, l: number, target: number): number {
  let lo = l;
  let hi = 0.92;
  if (luminance(h, s, lo) >= target) return lo;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(h, s, mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Pull a palette out of raw avatar bytes. Null if nothing usable is in there. */
export async function paletteFromImage(bytes: Buffer): Promise<Palette | null> {
  let raw: { data: Buffer; info: OutputInfo };
  try {
    raw = await sharp(bytes)
      .resize(48, 48, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }

  // 24 hue buckets (15° each): fine enough to separate blue from teal, coarse enough
  // that anti-aliasing on a logo edge doesn't split one colour across two buckets.
  const BUCKETS = 24;
  const weight = new Array<number>(BUCKETS).fill(0);
  const satSum = new Array<number>(BUCKETS).fill(0);
  const lightSum = new Array<number>(BUCKETS).fill(0);
  const count = new Array<number>(BUCKETS).fill(0);

  const { data } = raw;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue; // transparent padding
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.25) continue; // grey/white/black — chrome, not brand
    if (l < 0.12 || l > 0.94) continue; // near-black ground, blown highlights
    const b = Math.min(BUCKETS - 1, Math.floor(h * BUCKETS));
    weight[b] += s * s; // saturation-weighted: vivid pixels count more
    satSum[b] += s;
    lightSum[b] += l;
    count[b] += 1;
  }

  let best = -1;
  let bestW = 0;
  for (let b = 0; b < BUCKETS; b++) {
    if (weight[b] > bestW) {
      bestW = weight[b];
      best = b;
    }
  }
  // Require a real showing, not three stray pixels of JPEG fringing.
  if (best < 0 || count[best] < 12) return null;

  const hue = (best + 0.5) / BUCKETS;
  const sat = Math.min(1, Math.max(0.55, satSum[best] / count[best]));
  const lit = lightSum[best] / count[best];

  // Normalise for the eye, not the colour model: every accent must clear the same
  // perceptual brightness so a blue agent is as legible as an amber one at 25px.
  const accentL = liftToLuminance(hue, sat, Math.max(0.5, lit), 0.22);
  const accent2L = liftToLuminance(hue, sat * 0.9, accentL + 0.1, 0.42);
  // labels are tiny mono text on near-black: desaturate and push bright so a deep-blue
  // agent's "AGENT #… · LIVE" line is as readable as an amber one's.
  const labelL = liftToLuminance(hue, sat * 0.5, accent2L + 0.1, 0.6);

  return {
    accent: hslToHex(hue, sat, accentL),
    accent2: hslToHex(hue, Math.min(1, sat * 0.9), accent2L),
    label: hslToHex(hue, sat * 0.5, labelL),
    // ground keeps a whisper of the hue so the whole frame feels owned
    ink: hslToHex(hue, 0.36, 0.035),
  };
}

/** Fetch an avatar and derive its palette. Always resolves — falls back to Optic's. */
export async function paletteFromAvatar(url: string | null): Promise<Palette> {
  if (!url) return DEFAULT_PALETTE;
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_PALETTE;
    const buf = Buffer.from(await res.arrayBuffer());
    return (await paletteFromImage(buf)) ?? DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}
