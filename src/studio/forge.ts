// STUDIO /v1/forge — mint-ready metadata + IPFS-ready package. NO minting, NO pinning.
//
// What "IPFS-ready" means here, precisely: we compute CIDv1 (raw codec, sha2-256) for
// each file — the CID a pinning tool reproduces when adding the file as a single raw
// block (`ipfs add --cid-version 1 --raw-leaves` for files under the chunking limit).
// The response says exactly that, plus plain sha256 hashes, so nothing is overclaimed.
// Zero LLM, zero image generation: forge is deterministic packaging, COGS ≈ $0.
import { randomUUID, createHash } from "node:crypto";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import type { BudgetGuard } from "../pipeline/budget.js";
import { fetchImage, saveAsset } from "./shared.js";
import { isCliEntry } from "../fixtures.js";

export interface ForgeRequest {
  image_url: string;
  name: string;
  description: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  external_url?: string;
}

export interface ForgeResult {
  package_id: string;
  image: { url: string; cid_v1_raw: string; sha256: string; bytes: number };
  metadata: { url: string; cid_v1_raw: string; sha256: string; json: Record<string, unknown> };
  note: string;
  generated_at: string;
}

export class ForgeInputError extends Error {}

async function cidV1Raw(bytes: Buffer): Promise<string> {
  const hash = await sha256.digest(bytes);
  return CID.createV1(raw.code, hash).toString();
}

export async function forge(req: ForgeRequest, _budget: BudgetGuard): Promise<ForgeResult> {
  const name = req.name?.trim();
  const description = req.description?.trim();
  if (!name || name.length > 120) throw new ForgeInputError("name is required (≤120 chars)");
  if (!description || description.length > 2000) throw new ForgeInputError("description is required (≤2000 chars)");

  const attributes = (req.attributes ?? []).slice(0, 40).map((a) => {
    const trait = String(a.trait_type ?? "").slice(0, 64);
    const value = typeof a.value === "number" ? a.value : String(a.value ?? "").slice(0, 128);
    if (!trait) throw new ForgeInputError("every attribute needs a trait_type");
    return { trait_type: trait, value };
  });

  const src = await fetchImage(req.image_url);
  const id = randomUUID();

  const imageCid = await cidV1Raw(src.bytes);
  const imageSha = createHash("sha256").update(src.bytes).digest("hex");
  const imageUrl = saveAsset(id, "image.png", src.bytes);

  // ERC-721 metadata JSON standard shape; image points at the future IPFS location.
  const metadata: Record<string, unknown> = {
    name,
    description,
    image: `ipfs://${imageCid}`,
    ...(attributes.length ? { attributes } : {}),
    ...(req.external_url && /^https:\/\//.test(req.external_url) ? { external_url: req.external_url } : {}),
  };
  const metaBytes = Buffer.from(JSON.stringify(metadata, null, 2));
  const metaCid = await cidV1Raw(metaBytes);
  const metaSha = createHash("sha256").update(metaBytes).digest("hex");
  const metaUrl = saveAsset(id, "metadata.json", metaBytes);

  return {
    package_id: id,
    image: { url: imageUrl, cid_v1_raw: imageCid, sha256: imageSha, bytes: src.bytes.length },
    metadata: { url: metaUrl, cid_v1_raw: metaCid, sha256: metaSha, json: metadata },
    note:
      "CIDs are CIDv1/raw/sha2-256 — reproduced by any IPFS tool adding each file as a single raw block " +
      "(e.g. `ipfs add --cid-version 1 --raw-leaves`). Pin both files with your own pinning service, then mint " +
      "pointing at ipfs://<metadata cid>. This service prepares the package only; it does not pin or mint.",
    generated_at: new Date().toISOString(),
  };
}

if (isCliEntry(import.meta.url)) {
  const { BudgetGuard } = await import("../pipeline/budget.js");
  const [url, name, ...desc] = process.argv.slice(2);
  if (!url || !name) {
    console.error('usage: npm run forge -- <image_url> <name> <description…>');
    process.exit(1);
  }
  console.log(JSON.stringify(await forge({ image_url: url, name, description: desc.join(" ") || name }, new BudgetGuard()), null, 2));
}
