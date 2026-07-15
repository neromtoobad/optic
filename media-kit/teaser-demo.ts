import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

// Guided-tour demo cut (~32s): founder quote → the website → the OKX marketplace
// (real stats) → a live read (query → paid card) → close. Mirrors docs/DEMO_SCRIPT.md.
const W = 1280, H = 720, FPS = 30, DUR = 32;
const N = FPS * DUR;
const OUT = "/tmp/demo-frames";

const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-500.woff"), weight: 500 as const, style: "normal" as const },
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-600.woff"), weight: 600 as const, style: "normal" as const },
  { name: "Instrument Serif", data: readFileSync("/tmp/is-400.ttf"), weight: 400 as const, style: "normal" as const },
  { name: "Instrument Serif", data: readFileSync("/tmp/is-400i.ttf"), weight: 400 as const, style: "italic" as const },
];

const BG = "#05070d", INK = "#e8ebf2", AMBER = "#f5a623", MUTE = "#6d7688", SOFT = "#aab2c2";
const du = (p: string, mime = "image/jpeg") => `data:${mime};base64,${readFileSync(p).toString("base64")}`;
const MARK = du(join(process.cwd(), "media-kit/logo/optic-mark.png"), "image/png");
const IMG_SITE = du("/tmp/scene-site.jpg");
const IMG_OKX = du("/tmp/scene-okx.jpg");
const IMG_REVIEW = du("/tmp/scene-review.jpg");
const IMG_RUG = du(join(process.cwd(), "media-kit/web/rug.jpg"));
const IMG_DAILY = du(join(process.cwd(), "media-kit/web/daily.jpg"));

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const box = (style: string, inner = "") => `<div style="display:flex;position:absolute;${style}">${inner}</div>`;
const wm = (px: number) =>
  `<div style="display:flex;align-items:center;font-family:'Space Grotesk';font-weight:700;font-size:${px}px;letter-spacing:-1px;color:${INK};">OPTIC A<span style="display:flex;color:${AMBER};">I</span></div>`;
const kick = (t: string, extra = "") =>
  `<div style="display:flex;font-family:'IBM Plex Mono';font-weight:600;font-size:14px;letter-spacing:5px;color:${AMBER};${extra}">${t}</div>`;

// screenshot panel with corner ticks + slow zoom
function shot(img: string, op: number, scale: number, label: string, sub: string): string {
  const pw = 850, ph = Math.round((pw * 900) / 1440);
  const x0 = (W - pw) / 2, y0 = 96;
  const tick = (pos: string) => box(`${pos}width:22px;height:22px;border-color:rgba(245,166,35,.7);border-style:solid;opacity:${op};`);
  return [
    box(`top:${y0}px;left:${x0}px;width:${pw}px;height:${ph}px;opacity:${op};transform:scale(${scale});overflow:hidden;border:1px solid rgba(232,235,242,.15);`,
      `<img src="${img}" style="width:${pw}px;height:${ph}px;" />`),
    tick(`top:${y0 - 12}px;left:${x0 - 12}px;border-width:2px 0 0 2px;`),
    tick(`top:${y0 - 12}px;right:${x0 - 12}px;border-width:2px 2px 0 0;`),
    tick(`bottom:${H - y0 - ph - 12}px;left:${x0 - 12}px;border-width:0 0 2px 2px;`),
    tick(`bottom:${H - y0 - ph - 12}px;right:${x0 - 12}px;border-width:0 2px 2px 0;`),
    box(`top:56px;left:0;width:${W}px;justify-content:center;opacity:${op};`, kick(label)),
    box(`bottom:34px;left:0;width:${W}px;justify-content:center;opacity:${op};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-size:15px;letter-spacing:2px;color:${SOFT};">${sub}</div>`),
  ].join("");
}

function scene(t: number): string {
  const L: string[] = [];
  L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-color:${BG};`));
  L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-image:radial-gradient(circle at 74% 18%, rgba(245,166,35,.11), rgba(5,7,13,0) 55%);`));
  L.push(box(`bottom:0;left:0;width:${Math.round(W * clamp(t / DUR))}px;height:4px;background-color:${AMBER};`));

  // S1 0–5.5: founder quote → thesis
  if (t < 5.6) {
    if (t < 3.3) {
      const a = easeOut(seg(t, 0.1, 0.8));
      const fade = 1 - seg(t, 2.9, 3.25);
      L.push(box(`top:200px;left:0;width:${W}px;justify-content:center;opacity:${a * fade};`,
        `<div style="display:flex;flex-direction:column;align-items:center;max-width:980px;">
           <div style="display:flex;font-family:'Instrument Serif';font-style:italic;font-size:52px;line-height:1.15;color:${INK};text-align:center;">"The coming decade will be defined by one-person companies…"</div>
         </div>`));
      L.push(box(`top:400px;left:0;width:${W}px;justify-content:center;opacity:${easeOut(seg(t, 0.9, 1.5)) * fade};`,
        `<div style="display:flex;font-family:'IBM Plex Mono';font-weight:600;font-size:16px;letter-spacing:5px;color:${AMBER};">STAR XU · FOUNDER, OKX</div>`));
    } else {
      const fade = 1 - seg(t, 5.15, 5.55);
      const a1 = easeOutBack(seg(t, 3.35, 3.8));
      const a2 = easeOutBack(seg(t, 3.9, 4.4));
      L.push(box(`top:${H / 2 - 110}px;left:0;width:${W}px;justify-content:center;opacity:${clamp(a1) * fade};transform:scale(${0.92 + 0.08 * clamp(a1)});`,
        `<div style="display:flex;font-family:'Instrument Serif';font-size:64px;color:${INK};">OKX built the agent economy.</div>`));
      L.push(box(`top:${H / 2 + 4}px;left:0;width:${W}px;justify-content:center;opacity:${clamp(a2) * fade};transform:scale(${0.92 + 0.08 * clamp(a2)});`,
        `<div style="display:flex;font-family:'Instrument Serif';font-style:italic;font-size:64px;color:${AMBER};">We built the agent.</div>`));
    }
  }

  // S2 5.5–12: the website
  if (t >= 5.5 && t < 12.1) {
    const op = easeOut(seg(t, 5.6, 6.1)) * (1 - seg(t, 11.65, 12.05));
    const sc = 1 + 0.015 * seg(t, 5.6, 12);
    L.push(shot(IMG_SITE, op, sc, "01 · THE PRODUCT", "optic-production-5675.up.railway.app"));
  }

  // S3 12–18.5: the marketplace (stats → review)
  if (t >= 12 && t < 18.6) {
    const opA = easeOut(seg(t, 12.1, 12.6)) * (1 - seg(t, 14.9, 15.35));
    const opB = easeOut(seg(t, 15.15, 15.6)) * (1 - seg(t, 18.15, 18.55));
    const sc = 1 + 0.015 * seg(t, 12, 18.5);
    if (opA > 0.02) L.push(shot(IMG_OKX, opA, sc, "02 · LIVE ON OKX.AI · AGENT #4380", "5.0 SCORE · 100% POSITIVE · 39 SOLD"));
    if (opB > 0.02) L.push(shot(IMG_REVIEW, opB, sc, "02 · A REAL BUYER, FIVE STARS", "\"delivered narrative timing for ETH successfully via x402\" — a real buyer"));
  }

  // S4 18.5–27: live read — query types, card answers
  if (t >= 18.5 && t < 27.1) {
    const half = t < 22.9;
    const s = half ? 18.6 : 23.0;
    const q = half ? "> paste any token" : "> who wins the world cup";
    const img = half ? IMG_RUG : IMG_DAILY;
    const stamp = half ? "0.05 USDT · SETTLED ON-CHAIN" : "0.5 USDT · SETTLED ON-CHAIN";
    const end = half ? 22.9 : 27.0;
    const op = easeOut(seg(t, s, s + 0.3)) * (1 - seg(t, end - 0.3, end));
    const typed = q.slice(0, Math.max(0, Math.round(seg(t, s, s + 0.9) * q.length)));
    L.push(box(`top:84px;left:0;width:${W}px;justify-content:center;opacity:${op};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-size:27px;letter-spacing:2px;color:${SOFT};">${typed}<div style="display:flex;width:13px;height:30px;margin-left:6px;background-color:${AMBER};opacity:${Math.round(t * 3) % 2 === 0 ? 1 : 0};"></div></div>`));
    const pop = easeOutBack(seg(t, s + 1.0, s + 1.5));
    if (pop > 0) {
      const cw = 820, ch = Math.round((cw * 672) / 1200);
      L.push(box(`top:158px;left:${(W - cw) / 2}px;width:${cw}px;height:${ch}px;opacity:${clamp(pop) * op};transform:scale(${0.9 + 0.1 * clamp(pop)});border:1px solid rgba(232,235,242,.16);overflow:hidden;`,
        `<img src="${img}" style="width:${cw}px;height:${ch}px;" />`));
      L.push(box(`bottom:44px;left:0;width:${W}px;justify-content:center;opacity:${clamp(seg(t, s + 1.5, s + 1.9)) * op};`,
        `<div style="display:flex;align-items:center;font-family:'IBM Plex Mono';font-weight:600;font-size:15px;letter-spacing:4px;color:${AMBER};border:1.5px solid rgba(245,166,35,.55);padding:10px 18px;">${stamp}</div>`));
    }
  }

  // S5 27–32: outro
  if (t >= 27) {
    const a = easeOut(seg(t, 27.1, 27.7));
    const fade = 1 - seg(t, 31.5, 31.95);
    L.push(box(`top:${H / 2 - 158}px;left:${W / 2 - 56}px;width:112px;height:112px;opacity:${a * fade};`, `<img src="${MARK}" style="width:112px;height:112px;" />`));
    L.push(box(`top:${H / 2 - 24}px;left:0;width:${W}px;justify-content:center;opacity:${a * fade};`, wm(58)));
    L.push(box(`top:${H / 2 + 58}px;left:0;width:${W}px;justify-content:center;opacity:${seg(t, 27.5, 28.1) * fade};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-size:18px;letter-spacing:6px;color:${SOFT};">AGENT #4380 · OKX.AI</div>`));
    L.push(box(`top:${H / 2 + 98}px;left:0;width:${W}px;justify-content:center;opacity:${seg(t, 27.8, 28.4) * fade};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-size:14px;letter-spacing:3px;color:${MUTE};">optic-production-5675.up.railway.app</div>`));
  }

  return `<div style="display:flex;position:relative;width:${W}px;height:${H}px;font-family:'Space Grotesk';">${L.join("")}</div>`;
}

async function frame(t: number): Promise<Buffer> {
  const svg = await satori(html(scene(t)) as Parameters<typeof satori>[0], { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}

if (process.argv[2] === "sample") {
  mkdirSync("/tmp/demo-sample", { recursive: true });
  for (const t of [1.5, 4.4, 8.5, 13.5, 16.5, 20.8, 25.0, 29.5]) {
    writeFileSync(`/tmp/demo-sample/t${t}.png`, await frame(t));
    console.log("sample", t);
  }
} else {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    writeFileSync(join(OUT, `f${String(i).padStart(4, "0")}.png`), await frame(i / FPS));
    if (i % 90 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`rendered ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
