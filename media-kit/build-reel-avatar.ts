import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

// Agent Reel avatar — same system as build.ts (dark base, corner ticks, house
// fonts) with its own mark: a play-triangle inside a film frame. The agent brand
// stays fixed even though every rendered reel adopts the customer's palette.
const ROOT = join(process.cwd(), "media-kit");
const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
];

const BG = "#05070d";
const INK = "#e8ebf2";
const AMBER = "#f5a623";
const MUTE = "#6d7688";

const corner = (pos: string) =>
  `<div style="display:flex;position:absolute;width:22px;height:22px;${pos}border-color:rgba(232,235,242,.45);border-style:solid;"></div>`;

// Film frame: rounded rect with sprocket notches left+right, play triangle centered.
const sprockets = (side: "left" | "right") =>
  [0, 1, 2, 3]
    .map(
      (i) =>
        `<div style="display:flex;position:absolute;${side}:36px;top:${76 + i * 90}px;width:30px;height:48px;background-color:${BG};border:4px solid rgba(232,235,242,.45);"></div>`
    )
    .join("");

// satori renders CSS border-triangles as filled boxes — use a real SVG triangle.
const playSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="88" viewBox="0 0 72 88"><polygon points="0,0 72,44 0,88" fill="${AMBER}"/></svg>`;
const PLAY = `data:image/svg+xml;base64,${Buffer.from(playSvg).toString("base64")}`;

// Text-free, mark-alone (user direction): the film frame IS the avatar — full-bleed,
// no corner ticks, no words. Small breathing margin so the rounded frame reads on
// square and circle-cropped surfaces alike.
const mark = `
  <div style="display:flex;position:relative;width:456px;height:428px;border:9px solid ${INK};border-radius:40px;background-color:rgba(232,235,242,.03);align-items:center;justify-content:center;">
    ${sprockets("left")}
    ${sprockets("right")}
    <img src="${PLAY}" style="width:150px;height:184px;margin-left:22px;" />
  </div>`;

const tree = `<div style="display:flex;align-items:center;justify-content:center;width:512px;height:512px;background-color:${BG};position:relative;">
  <div style="display:flex;position:absolute;top:0;left:0;width:512px;height:512px;background-image:radial-gradient(circle at 50% 50%, rgba(245,166,35,.18) 0%, rgba(5,7,13,0) 64%);"></div>
  ${mark}
</div>`;

const svg = await satori(html(tree) as Parameters<typeof satori>[0], { width: 512, height: 512, fonts: FONTS });
writeFileSync(join(ROOT, "logo/reel-avatar.svg"), svg);
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
writeFileSync(join(ROOT, "logo/reel-avatar.png"), png);
console.log("rendered logo/reel-avatar (512x512 @2x)");
