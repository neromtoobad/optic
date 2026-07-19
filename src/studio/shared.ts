// STUDIO shared plumbing — safe inbound image fetch + volume-backed output store.
//
// Every studio service that accepts an image URL goes through fetchImage: https-only,
// no private hosts (the server must never be a proxy into its own network), size- and
// time-capped, and the bytes must actually decode as an image before any work runs.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { config } from "../config.js";

const MAX_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

export class ImageFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageFetchError";
  }
}

/** Fetch a caller-supplied image URL with the full guard rail. */
export async function fetchImage(url: string): Promise<{ bytes: Buffer; width: number; height: number; format: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImageFetchError("image_url is not a valid URL");
  }
  if (parsed.protocol !== "https:") throw new ImageFetchError("image_url must be https");
  if (PRIVATE_HOST.test(parsed.hostname)) throw new ImageFetchError("image_url host is not allowed");

  const res = await fetch(parsed, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "image/*" },
  });
  if (!res.ok) throw new ImageFetchError(`image_url returned HTTP ${res.status}`);

  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new ImageFetchError("image is larger than 15MB");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new ImageFetchError("image is larger than 15MB");

  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new ImageFetchError("the URL did not return a decodable image");
  }
  if (!meta.width || !meta.height) throw new ImageFetchError("the URL did not return a decodable image");
  return { bytes, width: meta.width, height: meta.height, format: meta.format ?? "unknown" };
}

/** Persist an output file under the volume-backed assets dir; returns its public URL. */
export function saveAsset(id: string, filename: string, bytes: Buffer): string {
  const dir = join(config.assetsDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), bytes);
  return `${config.publicBaseUrl}/v1/assets/${id}/${filename}`;
}

/** Resolve a stored asset file, or null. Filenames are whitelisted by the caller. */
export function assetPath(id: string, filename: string): string | null {
  if (!/^[a-f0-9-]{8,64}$/.test(id) || !/^[\w.-]+$/.test(filename)) return null;
  const p = join(config.assetsDir, id, filename);
  return existsSync(p) ? p : null;
}
