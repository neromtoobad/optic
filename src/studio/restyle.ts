// STUDIO /v1/restyle — reframe, enlarge, flat-bg. Deterministic sharp ops only.
//
// Honesty rule (the reason outpaint was dropped): every operation here is a real
// pixel transform we can guarantee — attention-aware cropping, Lanczos resampling,
// alpha flattening. No generative fill, no "AI upscale" claims: enlarge is stated
// as resampling, and we cap it at 2x so we never sell invented detail.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { BudgetGuard } from "../pipeline/budget.js";
import { fetchImage, saveAsset, ImageFetchError } from "./shared.js";
import { isCliEntry } from "../fixtures.js";

const MAX_DIM = 4096;
const MAX_SCALE = 2;

export interface RestyleRequest {
  image_url: string;
  width?: number; // reframe target (with height)
  height?: number;
  scale?: number; // enlarge factor ≤2 (exclusive with width/height)
  background?: string; // hex — flatten transparency onto this
}

export interface RestyleResult {
  asset_id: string;
  restyled_url: string;
  source: { width: number; height: number; format: string };
  output: { width: number; height: number };
  ops: string[];
  generated_at: string;
}

export class RestyleInputError extends Error {}

export async function restyle(req: RestyleRequest, _budget: BudgetGuard): Promise<RestyleResult> {
  const ops: string[] = [];
  const src = await fetchImage(req.image_url);

  let img = sharp(src.bytes);

  if (req.background !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(req.background)) throw new RestyleInputError("background must be a #rrggbb hex");
    img = img.flatten({ background: req.background });
    ops.push(`flat-bg ${req.background}`);
  }

  let outW = src.width;
  let outH = src.height;

  if (req.width !== undefined || req.height !== undefined) {
    if (!req.width || !req.height) throw new RestyleInputError("reframe needs BOTH width and height");
    if (req.width > MAX_DIM || req.height > MAX_DIM || req.width < 16 || req.height < 16)
      throw new RestyleInputError(`width/height must be 16–${MAX_DIM}`);
    // attention-position cover crop: keeps the subject, not just the center
    img = img.resize(req.width, req.height, { fit: "cover", position: sharp.strategy.attention });
    outW = req.width;
    outH = req.height;
    ops.push(`reframe ${req.width}x${req.height} (attention crop)`);
  } else if (req.scale !== undefined) {
    if (!(req.scale > 1 && req.scale <= MAX_SCALE)) throw new RestyleInputError(`scale must be >1 and ≤${MAX_SCALE}`);
    outW = Math.round(src.width * req.scale);
    outH = Math.round(src.height * req.scale);
    if (outW > MAX_DIM || outH > MAX_DIM) throw new RestyleInputError(`scaled size exceeds ${MAX_DIM}px`);
    img = img.resize(outW, outH, { kernel: "lanczos3" });
    ops.push(`enlarge ${req.scale}x (Lanczos resample — no generative detail)`);
  }

  if (ops.length === 0) throw new RestyleInputError("nothing to do — provide width+height, scale, or background");

  const id = randomUUID();
  const png = await img.png().toBuffer();
  const url = saveAsset(id, "restyled.png", png);
  return {
    asset_id: id,
    restyled_url: url,
    source: { width: src.width, height: src.height, format: src.format },
    output: { width: outW, height: outH },
    ops,
    generated_at: new Date().toISOString(),
  };
}

export { ImageFetchError };

if (isCliEntry(import.meta.url)) {
  const { BudgetGuard } = await import("../pipeline/budget.js");
  const [url, w, h] = process.argv.slice(2);
  if (!url) {
    console.error("usage: npm run restyle -- <image_url> [width height]");
    process.exit(1);
  }
  const req: RestyleRequest = { image_url: url };
  if (w && h) {
    req.width = Number(w);
    req.height = Number(h);
  } else {
    req.scale = 2;
  }
  console.log(JSON.stringify(await restyle(req, new BudgetGuard()), null, 2));
}
