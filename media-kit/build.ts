import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

// Brand asset builder — renders the Optic AI logo, avatar, and X header from the
// same fonts + palette as the product cards, so the whole kit is one system.
const ROOT = join(process.cwd(), "media-kit");
const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-500.woff"), weight: 500 as const, style: "normal" as const },
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-600.woff"), weight: 600 as const, style: "normal" as const },
];

const BG = "#05070d";
const INK = "#e8ebf2";
const AMBER = "#f5a623";
const MUTE = "#6d7688";

// Rasterize the geometric mark once, at high res, to embed as a crisp <img>.
const markSvg = readFileSync(join(ROOT, "logo/optic-mark.svg"), "utf8");
const markPng = new Resvg(markSvg, { fitTo: { mode: "width", value: 400 } }).render().asPng();
const MARK = `data:image/png;base64,${markPng.toString("base64")}`;

// Wordmark: OPTIC AI with the signature amber "I".
const wordmark = (size: number) =>
  `<div style="display:flex;align-items:center;font-family:'Space Grotesk';font-weight:700;font-size:${size}px;letter-spacing:-1px;color:${INK};">OPTIC A<span style="display:flex;color:${AMBER};">I</span></div>`;

const corner = (pos: string) =>
  `<div style="display:flex;position:absolute;width:22px;height:22px;${pos}border-color:rgba(232,235,242,.45);border-style:solid;"></div>`;

async function render(name: string, w: number, h: number, tree: string) {
  const svg = await satori(html(tree) as Parameters<typeof satori>[0], { width: w, height: h, fonts: FONTS });
  writeFileSync(join(ROOT, `${name}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w * 2 } }).render().asPng(); // 2x for retina
  writeFileSync(join(ROOT, `${name}.png`), png);
  console.log(`rendered ${name} (${w}x${h})`);
}

// 1. Horizontal logo — transparent background (drops onto any surface).
await render(
  "logo/optic-logo",
  520,
  150,
  `<div style="display:flex;align-items:center;width:520px;height:150px;">
     <img src="${MARK}" style="width:112px;height:112px;margin-right:26px;" />
     <div style="display:flex;flex-direction:column;">
       ${wordmark(64)}
       <div style="display:flex;font-family:'IBM Plex Mono';font-weight:400;font-size:15px;letter-spacing:6px;color:${MUTE};margin-top:6px;">THE ONCHAIN ALPHA DESK</div>
     </div>
   </div>`
);

// 2. Avatar / app icon — 512 square, dark, mark centered with corner ticks.
await render(
  "logo/optic-avatar",
  512,
  512,
  `<div style="display:flex;align-items:center;justify-content:center;width:512px;height:512px;background-color:${BG};position:relative;">
     <div style="display:flex;position:absolute;top:0;left:0;width:512px;height:512px;background-image:radial-gradient(circle at 50% 42%, rgba(245,166,35,.10) 0%, rgba(5,7,13,0) 60%);"></div>
     ${corner("top:34px;left:34px;border-width:2px 0 0 2px;")}
     ${corner("top:34px;right:34px;border-width:2px 2px 0 0;")}
     ${corner("bottom:34px;left:34px;border-width:0 0 2px 2px;")}
     ${corner("bottom:34px;right:34px;border-width:0 2px 2px 0;")}
     <div style="display:flex;flex-direction:column;align-items:center;">
       <img src="${MARK}" style="width:228px;height:228px;" />
       <div style="display:flex;align-items:center;font-family:'Space Grotesk';font-weight:700;font-size:44px;letter-spacing:1px;color:${INK};margin-top:20px;">OPTIC A<span style="display:flex;color:${AMBER};">I</span></div>
     </div>
   </div>`
);

// 3. X / Twitter header — 1500x500, dark with a divergence motif.
// Divergence fan — two rays from a shared amber origin, fanning apart to the right.
const rays = [
  `<div style="display:flex;position:absolute;left:1120px;top:250px;width:470px;height:3px;background-color:rgba(232,235,242,.5);transform-origin:left center;transform:rotate(-20deg);"></div>`,
  `<div style="display:flex;position:absolute;left:1120px;top:250px;width:470px;height:3px;background-color:rgba(245,166,35,.9);transform-origin:left center;transform:rotate(-4deg);"></div>`,
  `<div style="display:flex;position:absolute;left:1110px;top:242px;width:19px;height:19px;border-radius:10px;background-color:${AMBER};"></div>`,
].join("");
await render(
  "social/optic-x-header",
  1500,
  500,
  `<div style="display:flex;width:1500px;height:500px;background-color:${BG};position:relative;font-family:'Space Grotesk';">
     <div style="display:flex;position:absolute;top:0;left:0;width:1500px;height:500px;background-image:radial-gradient(circle at 78% 50%, rgba(245,166,35,.10) 0%, rgba(5,7,13,0) 55%);"></div>
     ${rays}
     ${corner("top:40px;left:40px;border-width:2px 0 0 2px;")}
     ${corner("bottom:40px;left:40px;border-width:0 0 2px 2px;")}
     <div style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;width:1000px;">
       <div style="display:flex;align-items:center;margin-bottom:26px;">
         <img src="${MARK}" style="width:92px;height:92px;margin-right:24px;" />
         ${wordmark(72)}
       </div>
       <div style="display:flex;font-size:34px;font-weight:500;color:#aab2c2;letter-spacing:-0.5px;">Reads memecoins, prediction markets, stocks and attention as one economy.</div>
       <div style="display:flex;font-family:'IBM Plex Mono';font-size:17px;letter-spacing:5px;color:${MUTE};margin-top:22px;">CROSS-VENUE DIVERGENCE · x402 ON X LAYER · OKX.AI</div>
     </div>
   </div>`
);

console.log("done");
