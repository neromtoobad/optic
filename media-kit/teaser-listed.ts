import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

// "LISTED" hype cut — 15s kinetic type + divergence motif + rapid-fire real reads.
// Frame-deterministic scene(t), rendered by the same satori engine as the cards.
const W = 1280, H = 720, FPS = 30, DUR = 15;
const N = FPS * DUR;
const OUT = "/tmp/listed-frames";

const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
const FONTS = [
  { name: "Space Grotesk", data: font("sg-500.woff"), weight: 500 as const, style: "normal" as const },
  { name: "Space Grotesk", data: font("sg-700.woff"), weight: 700 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-400.woff"), weight: 400 as const, style: "normal" as const },
  { name: "IBM Plex Mono", data: font("ipm-600.woff"), weight: 600 as const, style: "normal" as const },
];

const BG = "#05070d", INK = "#e8ebf2", AMBER = "#f5a623", MUTE = "#6d7688", SOFT = "#aab2c2", TEAL = "#4be3c3", ORANGE = "#ff8a3d";
const MARK = `data:image/png;base64,${readFileSync(join(process.cwd(), "media-kit/logo/optic-mark.png")).toString("base64")}`;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const box = (style: string, inner = "") => `<div style="display:flex;position:absolute;${style}">${inner}</div>`;
const wm = (px: number) =>
  `<div style="display:flex;align-items:center;font-family:'Space Grotesk';font-weight:700;font-size:${px}px;letter-spacing:-1px;color:${INK};">OPTIC A<span style="display:flex;color:${AMBER};">I</span></div>`;

// Rapid-fire reads (real numbers from live tests)
const READS = [
  { q: "> who wins the world cup", big: "FRANCE 32.8%", sub: "argentina 16.7 · england 14.5 · live betting volume", color: ORANGE },
  { q: "> what is smart money buying", big: "ANSEM", sub: "34 wallets · $96.7K accumulated before the crowd", color: TEAL },
  { q: "> paste any token", big: "RISK 44/100", sub: "dev holds 57.7% · top-100 own 100% · receipts included", color: ORANGE },
  { q: "> nvda", big: "DIVERGENCE 38", sub: "consensus ~$302 vs price $195 · research ahead of price", color: AMBER },
];
const S3_START = 4.6, PER = 1.6;

function grid(t: number, op: number): string {
  // slow-drifting chart grid
  const off = Math.round((t * 6) % 128);
  const v = Array.from({ length: 12 }, (_, i) => box(`top:0;left:${i * 128 - off}px;width:1px;height:${H}px;background-color:rgba(232,235,242,${0.05 * op});`)).join("");
  const h = Array.from({ length: 7 }, (_, i) => box(`top:${i * 120}px;left:0;width:${W}px;height:1px;background-color:rgba(232,235,242,${0.05 * op});`)).join("");
  return v + h;
}

function scene(t: number): string {
  const L: string[] = [];
  L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-color:${BG};`));
  L.push(grid(t, 1));
  L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-image:radial-gradient(circle at 72% 26%, rgba(245,166,35,.13), rgba(5,7,13,0) 55%);`));

  // bottom progress bar (whole film)
  L.push(box(`bottom:0;left:0;width:${Math.round(W * clamp(t / DUR))}px;height:4px;background-color:${AMBER};`));

  // S1 0–2.2: hook
  if (t < 2.3) {
    const a1 = easeOutBack(seg(t, 0.05, 0.5));
    const a2 = easeOutBack(seg(t, 0.55, 1.0));
    const fade = 1 - seg(t, 1.9, 2.25);
    if (a1 > 0)
      L.push(box(`top:${H / 2 - 128}px;left:0;width:${W}px;justify-content:center;opacity:${clamp(a1) * fade};transform:scale(${0.9 + 0.1 * a1});`,
        `<div style="display:flex;font-family:'Space Grotesk';font-weight:700;font-size:66px;letter-spacing:-1px;color:${INK};">THE EDGE WAS NEVER</div>`));
    if (a2 > 0)
      L.push(box(`top:${H / 2 - 40}px;left:0;width:${W}px;justify-content:center;opacity:${clamp(a2) * fade};transform:scale(${0.9 + 0.1 * a2});`,
        `<div style="display:flex;font-family:'Space Grotesk';font-weight:700;font-size:66px;letter-spacing:-1px;color:${MUTE};">INSIDE ONE MARKET.</div>`));
  }

  // S2 2.2–4.6: divergence draw + line 2
  if (t >= 2.2 && t < 4.7) {
    const fade = seg(t, 2.2, 2.5) * (1 - seg(t, 4.35, 4.65));
    const cx = 520, cy = 400;
    const draw = easeOut(seg(t, 2.3, 3.1));
    // incoming line
    L.push(box(`top:${cy - 4}px;left:${cx - 420 * draw}px;width:${420 * draw}px;height:8px;background-color:${INK};opacity:${fade};`));
    // diverging rays
    const grow = easeOut(seg(t, 3.0, 3.9));
    if (grow > 0) {
      L.push(box(`top:${cy - 4}px;left:${cx}px;width:${560 * grow}px;height:8px;background-color:${AMBER};opacity:${fade};transform-origin:left center;transform:rotate(-21deg);`));
      L.push(box(`top:${cy - 4}px;left:${cx}px;width:${480 * grow}px;height:7px;background-color:#5b647a;opacity:${fade};transform-origin:left center;transform:rotate(13deg);`));
    }
    L.push(box(`top:${cy - 15}px;left:${cx - 15}px;width:30px;height:30px;border-radius:15px;background-color:${AMBER};opacity:${fade};transform:scale(${0.6 + 0.4 * easeOutBack(seg(t, 3.0, 3.4))});`));
    const txt = seg(t, 3.3, 3.9);
    L.push(box(`top:150px;left:0;width:${W}px;justify-content:center;opacity:${txt * fade};`,
      `<div style="display:flex;font-family:'Space Grotesk';font-weight:700;font-size:58px;letter-spacing:-1px;color:${INK};">IT'S IN THE GAP <span style="display:flex;color:${AMBER};margin-left:18px;">BETWEEN THEM.</span></div>`));
  }

  // S3 4.6–11.0: rapid reads
  READS.forEach((r, i) => {
    const s = S3_START + i * PER, e = s + PER;
    if (t < s || t > e + 0.05) return;
    const inA = easeOut(seg(t, s, s + 0.22));
    const fade = inA * (1 - seg(t, e - 0.18, e));
    if (fade < 0.02) return;
    // query line types on
    const q = r.q.slice(0, Math.max(0, Math.round(seg(t, s, s + 0.5) * r.q.length)));
    L.push(box(`top:200px;left:0;width:${W}px;justify-content:center;opacity:${fade};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-weight:400;font-size:26px;letter-spacing:2px;color:${SOFT};">${q}<div style="display:flex;width:14px;height:30px;margin-left:6px;background-color:${AMBER};opacity:${Math.round(t * 3) % 2 === 0 ? 1 : 0};"></div></div>`));
    const pop = easeOutBack(seg(t, s + 0.45, s + 0.8));
    if (pop > 0) {
      L.push(box(`top:280px;left:0;width:${W}px;justify-content:center;opacity:${clamp(pop) * fade};transform:scale(${0.85 + 0.15 * pop});`,
        `<div style="display:flex;font-family:'IBM Plex Mono';font-weight:600;font-size:110px;letter-spacing:-2px;color:${r.color};">${r.big}</div>`));
      L.push(box(`top:432px;left:0;width:${W}px;justify-content:center;opacity:${clamp(pop) * fade};`,
        `<div style="display:flex;font-family:'IBM Plex Mono';font-size:22px;letter-spacing:1px;color:${MUTE};">${r.sub}</div>`));
    }
    // read index ticks
    L.push(box(`top:520px;left:0;width:${W}px;justify-content:center;opacity:${fade};`,
      READS.map((_, j) => `<div style="display:flex;width:30px;height:5px;margin:0 5px;background-color:${j === i ? AMBER : "rgba(255,255,255,.15)"};"></div>`).join("")));
  });

  // S4 11.0–13.2: NOW LISTED slam
  if (t >= 11.0 && t < 13.3) {
    const slam = easeOutBack(seg(t, 11.05, 11.45));
    const fade = 1 - seg(t, 12.95, 13.25);
    const flash = Math.max(0, 1 - seg(t, 11.05, 11.5)) * 0.25;
    L.push(box(`top:0;left:0;width:${W}px;height:${H}px;background-color:rgba(245,166,35,${flash});`));
    L.push(box(`top:${H / 2 - 130}px;left:0;width:${W}px;justify-content:center;opacity:${clamp(slam) * fade};transform:scale(${1.5 - 0.5 * clamp(slam)});`,
      `<div style="display:flex;flex-direction:column;align-items:center;border:6px solid ${AMBER};padding:34px 66px;">
         <div style="display:flex;font-family:'Space Grotesk';font-weight:700;font-size:104px;letter-spacing:2px;color:${INK};">NOW LISTED</div>
       </div>`));
    const sub = seg(t, 11.5, 11.95);
    L.push(box(`top:${H / 2 + 106}px;left:0;width:${W}px;justify-content:center;opacity:${sub * fade};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-weight:600;font-size:24px;letter-spacing:8px;color:${AMBER};">OKX.AI AGENT MARKETPLACE</div>`));
  }

  // S5 13.2–15: brand outro
  if (t >= 13.2) {
    const a = easeOut(seg(t, 13.3, 13.9));
    const fade = 1 - seg(t, 14.55, 14.95);
    L.push(box(`top:${H / 2 - 165}px;left:${W / 2 - 60}px;width:120px;height:120px;opacity:${a * fade};`, `<img src="${MARK}" style="width:120px;height:120px;" />`));
    L.push(box(`top:${H / 2 - 20}px;left:0;width:${W}px;justify-content:center;opacity:${a * fade};`, wm(60)));
    const l = seg(t, 13.6, 14.1);
    L.push(box(`top:${H / 2 + 66}px;left:0;width:${W}px;justify-content:center;opacity:${l * fade};`,
      `<div style="display:flex;font-family:'IBM Plex Mono';font-size:19px;letter-spacing:6px;color:${SOFT};">7 SERVICES · x402 ON X LAYER · AGENT #4380</div>`));
  }

  return `<div style="display:flex;position:relative;width:${W}px;height:${H}px;font-family:'Space Grotesk';">${L.join("")}</div>`;
}

async function frame(t: number): Promise<Buffer> {
  const svg = await satori(html(scene(t)) as Parameters<typeof satori>[0], { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}

if (process.argv[2] === "sample") {
  mkdirSync("/tmp/listed-sample", { recursive: true });
  for (const t of [0.7, 1.4, 3.6, 5.6, 7.4, 9.0, 10.4, 11.6, 12.4, 14.2]) {
    writeFileSync(`/tmp/listed-sample/t${t}.png`, await frame(t));
    console.log("sample", t);
  }
} else {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    writeFileSync(join(OUT, `f${String(i).padStart(4, "0")}.png`), await frame(i / FPS));
    if (i % 60 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`rendered ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
