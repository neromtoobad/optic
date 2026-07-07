import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

// Card-montage teaser: a ~15s frame-deterministic animation rendered with the
// same satori engine as the product cards, then assembled to MP4 by ffmpeg.
// Each frame is scene(t) — no CSS animation, so it renders identically headless.
const W = 1280, H = 720, FPS = 30, DUR = 15;
const N = FPS * DUR;
const OUT = "/tmp/teaser-frames";

const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-500.woff"), weight: 500 as const, style: "normal" as const },
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-600.woff"), weight: 600 as const, style: "normal" as const },
];

const BG = "#05070d", INK = "#e8ebf2", AMBER = "#f5a623", MUTE = "#6d7688", SOFT = "#aab2c2";
const du = (p: string, mime: string) => `data:${mime};base64,${readFileSync(join(process.cwd(), p)).toString("base64")}`;
const MARK = du("media-kit/logo/optic-mark.png", "image/png");
const ORDER = ["read", "stocks", "daily", "edge", "rug", "smart", "timing"];
const CARD_IMG: Record<string, string> = Object.fromEntries(ORDER.map((k) => [k, du(`media-kit/web/${k}.jpg`, "image/jpeg")]));
const NAME: Record<string, [string, string]> = {
  read: ["Cross-venue read", "0.5"], stocks: ["Stocks Desk", "0.5"], daily: ["Daily Alpha", "0.5"],
  edge: ["Edge Radar", "0.5"], rug: ["Rug Radar", "0.05"], smart: ["Smart Money", "0.05"], timing: ["Narrative Timing", "0.05"],
};

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a)); // 0..1 across [a,b]
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const wm = (px: number, color = INK) =>
  `<div style="display:flex;align-items:center;font-family:'Space Grotesk';font-weight:700;font-size:${px}px;letter-spacing:-1px;color:${color};">OPTIC A<span style="display:flex;color:${AMBER};">I</span></div>`;

// montage layout
const M_START = 2.8, ADV = 1.28, LIFE = 1.62;
const M_LAST_END = M_START + (ORDER.length - 1) * ADV + LIFE;
const O_START = M_LAST_END - 0.15;

function box(style: string, inner = ""): string {
  return `<div style="display:flex;position:absolute;${style}">${inner}</div>`;
}

function scene(t: number): string {
  const L: string[] = [];
  L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-color:${BG};`));
  L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-image:radial-gradient(circle at 76% 20%, rgba(245,166,35,.12), rgba(5,7,13,0) 55%);`));

  const inMontage = t >= M_START - 0.2 && t < O_START + 0.2;

  // Persistent frame during montage: corner ticks + tiny wordmark + okx.ai
  if (inMontage) {
    const fo = seg(t, M_START - 0.2, M_START + 0.3) * (1 - seg(t, O_START - 0.3, O_START + 0.1));
    const tick = (pos: string) => box(`${pos}width:20px;height:20px;border-color:rgba(232,235,242,${0.4 * fo});border-style:solid;`);
    L.push(tick("top:46px;left:46px;border-width:2px 0 0 2px;"));
    L.push(tick("top:46px;right:46px;border-width:2px 2px 0 0;"));
    L.push(tick("bottom:46px;left:46px;border-width:0 0 2px 2px;"));
    L.push(tick("bottom:46px;right:46px;border-width:0 2px 2px 0;"));
    L.push(box(`top:52px;left:70px;opacity:${fo};`, wm(22)));
    L.push(box(`top:56px;right:70px;font-family:'IBM Plex Mono';font-weight:600;font-size:14px;letter-spacing:4px;color:${MUTE};opacity:${fo};`, "OKX.AI"));

    // progress ticks
    const cur = Math.round(clamp((t - M_START) / ADV, 0, ORDER.length - 1));
    const ticks = ORDER.map((_, i) => `<div style="display:flex;width:26px;height:4px;margin-left:6px;background-color:${i === cur ? AMBER : "rgba(255,255,255,.16)"};"></div>`).join("");
    L.push(box(`bottom:60px;left:0;width:${W}px;height:4px;justify-content:center;opacity:${fo};`, ticks));
  }

  // INTRO
  if (t < 3.0) {
    const fade = 1 - seg(t, 2.5, 2.95);
    const mo = seg(t, 0, 0.7) * fade;
    const ms = 0.62 + 0.38 * easeOut(seg(t, 0, 0.95));
    L.push(box(`top:${H / 2 - 150}px;left:${W / 2 - 90}px;width:180px;height:180px;opacity:${mo};transform:scale(${ms});`, `<img src="${MARK}" style="width:180px;height:180px;" />`));
    const wo = seg(t, 0.7, 1.5) * fade;
    const wy = (1 - easeOut(seg(t, 0.7, 1.5))) * 22;
    L.push(box(`top:${H / 2 + 52}px;left:0;width:${W}px;justify-content:center;opacity:${wo};transform:translateY(${wy}px);`, wm(64)));
    const ko = seg(t, 1.4, 2.1) * fade;
    L.push(box(`top:${H / 2 + 138}px;left:0;width:${W}px;justify-content:center;font-family:'IBM Plex Mono';font-weight:400;font-size:17px;letter-spacing:8px;color:${MUTE};opacity:${ko};`, "THE ONCHAIN ALPHA DESK"));
  }

  // MONTAGE cards
  if (inMontage) {
    ORDER.forEach((k, i) => {
      const s = M_START + i * ADV, e = s + LIFE;
      if (t < s - 0.05 || t > e + 0.05) return;
      const inA = easeOut(seg(t, s, s + 0.34));
      const outA = easeInOut(seg(t, e - 0.34, e));
      const op = inA * (1 - outA);
      if (op < 0.02) return;
      const tx = 150 * (1 - inA) - 150 * outA;
      const sc = 0.965 + 0.035 * inA;
      const cw = 1000, ch = Math.round((cw * 672) / 1200);
      L.push(box(`top:${H / 2 - ch / 2 - 22}px;left:${W / 2 - cw / 2}px;width:${cw}px;height:${ch}px;opacity:${op};transform:translateX(${tx}px) scale(${sc});border-radius:6px;overflow:hidden;`, `<img src="${CARD_IMG[k]}" style="width:${cw}px;height:${ch}px;" />`));
      const [nm, pr] = NAME[k];
      L.push(box(`bottom:96px;left:0;width:${W}px;justify-content:center;align-items:baseline;opacity:${op};`,
        `<div style="display:flex;font-family:'IBM Plex Mono';font-weight:600;font-size:19px;letter-spacing:5px;text-transform:uppercase;color:${INK};">${nm}</div><div style="display:flex;font-family:'IBM Plex Mono';font-weight:600;font-size:19px;color:${AMBER};margin-left:16px;">${pr} USDT</div>`));
    });
  }

  // OUTRO
  if (t >= O_START) {
    const fade = 1 - seg(t, DUR - 0.9, DUR - 0.35);
    const mo = seg(t, O_START + 0.15, O_START + 0.85) * fade;
    L.push(box(`top:${H / 2 - 150}px;left:${W / 2 - 62}px;width:124px;height:124px;opacity:${mo};`, `<img src="${MARK}" style="width:124px;height:124px;" />`));
    L.push(box(`top:${H / 2 + 2}px;left:0;width:${W}px;justify-content:center;opacity:${mo};`, wm(58)));
    const l1 = seg(t, O_START + 0.5, O_START + 1.1) * fade;
    L.push(box(`top:${H / 2 + 86}px;left:0;width:${W}px;justify-content:center;font-family:'IBM Plex Mono';font-weight:400;font-size:18px;letter-spacing:6px;color:${SOFT};opacity:${l1};`, "7 SERVICES · x402 ON X LAYER"));
    const l2 = seg(t, O_START + 0.8, O_START + 1.4) * fade;
    L.push(box(`top:${H / 2 + 128}px;left:0;width:${W}px;justify-content:center;font-family:'IBM Plex Mono';font-weight:600;font-size:15px;letter-spacing:5px;color:${MUTE};opacity:${l2};`, "OKX.AI · AGENT #4380"));
  }

  return `<div style="display:flex;position:relative;width:${W}px;height:${H}px;font-family:'Space Grotesk';">${L.join("")}</div>`;
}

async function frame(t: number): Promise<Buffer> {
  const svg = await satori(html(scene(t)) as Parameters<typeof satori>[0], { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}

const mode = process.argv[2];
if (mode === "sample") {
  mkdirSync("/tmp/teaser-sample", { recursive: true });
  const times = [0.4, 1.2, 2.1, 3.2, 5.0, 7.5, 10.2, 12.6, 13.6, 14.4];
  for (let i = 0; i < times.length; i++) {
    writeFileSync(`/tmp/teaser-sample/s${i}_t${times[i]}.png`, await frame(times[i]));
    console.log("sample", times[i]);
  }
} else {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    writeFileSync(join(OUT, `f${String(i).padStart(4, "0")}.png`), await frame(i / FPS));
    if (i % 30 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`rendered ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${OUT}`);
}
