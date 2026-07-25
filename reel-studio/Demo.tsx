import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// AGENT REEL — 90s submission demo.
//
// Every asset on screen is a REAL paid output from the live service (the ScoutGate
// reel was a 0.5 USDT delivery; the heroes came from paid /v1/asset calls). Scene
// boundaries are driven by BEATS, measured from the actual voiceover's sentence
// pauses so the visuals land with the narration rather than guessing.

const F = {
  sans: "'Space Grotesk', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

const C = {
  ink: "#05070d",
  text: "#eef1f6",
  sub: "#aab2c2",
  mute: "#6d7688",
  amber: "#f5a623",
  amber2: "#ffc65c",
  teal: "#4be3c3",
  line: "rgba(255,255,255,.10)",
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;
const ease = Easing.bezier(...EASE);

export interface Caption {
  from: number; // frame
  to: number;
  text: string;
}

export interface DemoProps {
  /** Scene starts: [hook, services, promoReel, customBrief, hero, threeUp, proof, close] */
  beats: number[];
  captions: Caption[];
  /** Absolute frame the ScoutGate reel starts playing inside the promo-reel scene. */
  reelPlayFrom: number;
  vo: string; // staticFile name of the voiceover
}

export const DEMO_DEFAULTS: DemoProps = {
  beats: [0, 240, 560, 1150, 1420, 1800, 2200, 2520],
  captions: [],
  reelPlayFrom: 900,
  vo: "vo.wav",
};

// ── helpers ───────────────────────────────────────────────────────────────

const fadeIn = (frame: number, at: number, dur = 18) =>
  interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const rise = (frame: number, at: number, dur = 22, px = 22) =>
  interpolate(frame, [at, at + dur], [px, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Typewriter that reveals `text` between two frames. */
const typed = (text: string, frame: number, from: number, dur: number) => {
  const n = Math.round(
    interpolate(frame, [from, from + dur], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  return text.slice(0, n);
};

/** The Agent Reel mark: film frame + play triangle. */
const Mark: React.FC<{ size: number; glow?: number }> = ({ size, glow = 1 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 100 90" style={{ filter: `drop-shadow(0 0 ${26 * glow}px rgba(245,166,35,${0.35 * glow}))` }}>
    <rect x="4" y="4" width="92" height="82" rx="12" fill="rgba(238,241,246,.03)" stroke={C.text} strokeWidth="4" />
    {[16, 39, 62].map((y) => (
      <React.Fragment key={y}>
        <rect x="14" y={y} width="8" height="12" fill="none" stroke={C.mute} strokeWidth="3" />
        <rect x="78" y={y} width="8" height="12" fill="none" stroke={C.mute} strokeWidth="3" />
      </React.Fragment>
    ))}
    <polygon points="42,26 68,45 42,64" fill={C.amber} />
  </svg>
);

/** Living ground: grid, drifting glows, vignette. Present in every scene. */
const Ground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          maskImage: "radial-gradient(78% 66% at 50% 46%, #000 0%, transparent 92%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(46% 40% at ${18 + t * 30}% -6%, rgba(245,166,35,.16), transparent 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(44% 38% at ${88 - t * 26}% 104%, rgba(75,227,195,.12), transparent 62%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 420px 150px rgba(0,0,0,.86)" }} />
    </AbsoluteFill>
  );
};

/** Persistent brand furniture: mark top-left, agent id top-right. */
const Chrome: React.FC = () => (
  <AbsoluteFill style={{ padding: "52px 64px", justifyContent: "space-between", pointerEvents: "none" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Mark size={38} glow={0.5} />
        <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 24, letterSpacing: 0.4, color: C.text }}>
          Agent<span style={{ color: C.amber }}> Reel</span>
        </span>
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: "0.22em", color: C.mute }}>AGENT #6731 · OKX.AI</span>
    </div>
    <div />
  </AbsoluteFill>
);

/** Burned-in captions — the video reads correctly with sound off. */
const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const cur = captions.find((c) => frame >= c.from && frame < c.to);
  if (!cur) return null;
  const o = Math.min(fadeIn(frame, cur.from, 8), interpolate(frame, [cur.to - 8, cur.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 200px 58px" }}>
      <div
        style={{
          opacity: o,
          fontFamily: F.mono,
          fontSize: 25,
          lineHeight: 1.5,
          color: "rgba(238,241,246,.9)",
          textAlign: "center",
          background: "rgba(5,7,13,.62)",
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: "14px 26px",
          maxWidth: 1360,
        }}
      >
        {cur.text}
      </div>
    </AbsoluteFill>
  );
};

/** Crossfade wrapper so scene cuts never flash. */
const Cut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [0, 12, dur - 12, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 30 }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap, padding: "150px 120px 190px" }}>
    {children}
  </AbsoluteFill>
);

const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({ children, delay = 0, color = C.mute }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 19,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color,
        opacity: fadeIn(frame, delay),
      }}
    >
      {children}
    </div>
  );
};

// ── scene 1: the hook ─────────────────────────────────────────────────────

const LISTING_NOISE =
  "Provides comprehensive on-chain analytics and multi-chain data aggregation services for automated agent workflows, " +
  "including token metadata resolution, liquidity depth snapshots, holder distribution analysis, historical candle series, " +
  "wallet clustering heuristics, cross-venue price reconciliation, sentiment index computation, event-driven webhooks, " +
  "programmatic order construction, portfolio reconciliation, risk scoring pipelines, and extensible integration surfaces ";

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {/* the wall of text, drifting up behind everything */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [20, 60, 150, 210], [0, 0.3, 0.3, 0.1], { extrapolateRight: "clamp" }) }}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 22,
            lineHeight: 1.85,
            color: "#5d6474",
            padding: "0 90px",
            transform: `translateY(${180 - frame * 0.55}px)`,
          }}
        >
          {LISTING_NOISE.repeat(6)}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(58% 52% at 50% 52%, rgba(5,7,13,.94) 0%, rgba(5,7,13,.55) 70%, transparent 100%)" }} />
      <Stage gap={34}>
        <div style={{ opacity: fadeIn(frame, 6, 26), transform: `scale(${interpolate(frame, [6, 40], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })})` }}>
          <Mark size={150} />
        </div>
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 700,
            fontSize: 82,
            letterSpacing: -1.6,
            color: C.text,
            textAlign: "center",
            opacity: fadeIn(frame, 74, 24),
            transform: `translateY(${rise(frame, 74, 26)}px)`,
          }}
        >
          Three seconds to earn a click.
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

// ── scene 2: the five services ────────────────────────────────────────────

const SERVICES: Array<{ name: string; price: string }> = [
  { name: "Promo Reel", price: "0.5" },
  { name: "Hero Image Studio", price: "0.1" },
  { name: "Brand Kit Builder", price: "0.1" },
  { name: "Image Restyler", price: "0.1" },
  { name: "Mint Package Forge", price: "0.1" },
];

const Services: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage gap={44}>
      <Eyebrow delay={2}>A studio for the agent economy</Eyebrow>
      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 700,
          fontSize: 74,
          letterSpacing: -1.4,
          color: C.text,
          textAlign: "center",
          opacity: fadeIn(frame, 12),
          transform: `translateY(${rise(frame, 12)}px)`,
        }}
      >
        Five services. One call each.
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", maxWidth: 1500 }}>
        {SERVICES.map((s, i) => {
          const at = 46 + i * 13;
          return (
            <div
              key={s.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px 30px",
                borderRadius: 999,
                border: `1px solid ${C.line}`,
                background: "linear-gradient(180deg, rgba(238,241,246,.055), rgba(238,241,246,.02))",
                opacity: fadeIn(frame, at, 16),
                transform: `translateY(${rise(frame, at, 20, 16)}px)`,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 999, background: C.amber, boxShadow: `0 0 14px ${C.amber}` }} />
              <span style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 31, color: C.text }}>{s.name}</span>
              <span style={{ fontFamily: F.mono, fontSize: 24, color: C.amber2 }}>{s.price} USDT</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 22, color: C.teal, opacity: fadeIn(frame, 130) }}>
        paid per call · settled onchain
      </div>
    </Stage>
  );
};

// ── scene 3: the promo reel, end to end ───────────────────────────────────

const CodeCard: React.FC<{ frame: number; from: number }> = ({ frame, from }) => {
  const body = '{ "query": "5776" }';
  return (
    <div
      style={{
        width: 760,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(8,10,16,.92)",
        opacity: fadeIn(frame, from, 14),
        transform: `translateY(${rise(frame, from, 20, 18)}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: `1px solid ${C.line}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c, opacity: 0.85 }} />
        ))}
        <span style={{ fontFamily: F.mono, fontSize: 17, color: C.mute, marginLeft: 10 }}>the whole request</span>
      </div>
      <div style={{ padding: "26px 26px 30px", fontFamily: F.mono, fontSize: 27, lineHeight: 1.7 }}>
        <div style={{ color: C.teal }}>
          POST <span style={{ color: C.text }}>/v1/reel</span>
        </div>
        <div style={{ color: C.amber2, marginTop: 6 }}>
          {typed(body, frame, from + 22, 34)}
          <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: C.text }}>▌</span>
        </div>
      </div>
    </div>
  );
};

const STEPS = [
  "reads their live listing",
  "palette from their own avatar",
  "one honest line, their own words",
];

const Steps: React.FC<{ frame: number; from: number }> = ({ frame, from }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 760 }}>
    {STEPS.map((s, i) => {
      const at = from + i * 16;
      return (
        <div
          key={s}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "18px 26px",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            background: "rgba(238,241,246,.035)",
            opacity: fadeIn(frame, at, 14),
            transform: `translateX(${interpolate(frame, [at, at + 20], [-18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })}px)`,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 20, color: C.teal }}>0{i + 1}</span>
          <span style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 30, color: C.text }}>{s}</span>
        </div>
      );
    })}
  </div>
);

const PromoReel: React.FC<{ playFrom: number }> = ({ playFrom }) => {
  const frame = useCurrentFrame();
  // Left column: request → steps. Right: the delivered reel.
  const videoIn = fadeIn(frame, playFrom - 16, 22);
  return (
    <AbsoluteFill style={{ padding: "148px 96px 180px", flexDirection: "row", alignItems: "center", gap: 56 }}>
      <div style={{ flex: "0 0 760px", display: "flex", flexDirection: "column", gap: 22 }}>
        <Eyebrow delay={2} color={C.teal}>01 · Promo Reel · 0.5 USDT</Eyebrow>
        <CodeCard frame={frame} from={10} />
        <Steps frame={frame} from={86} />
      </div>
      <div
        style={{
          flex: 1,
          opacity: videoIn,
          transform: `scale(${interpolate(videoIn, [0, 1], [0.96, 1])})`,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px -40px rgba(0,0,0,.95)", background: "#000", aspectRatio: "16 / 9" }}>
          {/* nested Sequence so the clip's OWN timeline starts here — media inside a
              Sequence otherwise inherits the parent's frame and plays from the middle */}
          <Sequence from={playFrom} layout="none">
            <OffthreadVideo src={staticFile("scoutgate-reel.mp4")} muted style={{ width: "100%", display: "block" }} />
          </Sequence>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontSize: 20, color: C.sub }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: C.teal, boxShadow: `0 0 14px ${C.teal}` }} />
          REAL DELIVERY · ScoutGate #5776 · rendered in ~60s
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── scene 3b: custom briefs — anyone, not just listed agents ──────────────

const BRIEF_FIELDS: Array<[string, string]> = [
  ["name", "\"X Layer\""],
  ["description", "\"OKX's ZK-powered Ethereum L2…\""],
  ["image_url", "\"…/xlayer-logo.png\""],
];

const CustomBrief: React.FC = () => {
  const frame = useCurrentFrame();
  const videoAt = 74;
  return (
    <AbsoluteFill style={{ padding: "148px 96px 180px", flexDirection: "row", alignItems: "center", gap: 56 }}>
      <div style={{ flex: "0 0 700px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Eyebrow delay={2} color={C.teal}>No listing required</Eyebrow>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 58, lineHeight: 1.08, letterSpacing: -1.2, color: C.text, opacity: fadeIn(frame, 8), transform: `translateY(${rise(frame, 8)}px)` }}>
          Any brand.<br />Any human.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {BRIEF_FIELDS.map(([k, v], i) => {
            const at = 32 + i * 14;
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "baseline",
                  fontFamily: F.mono,
                  fontSize: 24,
                  padding: "14px 22px",
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  background: "rgba(238,241,246,.035)",
                  opacity: fadeIn(frame, at, 14),
                  transform: `translateX(${interpolate(frame, [at, at + 20], [-16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })}px)`,
                }}
              >
                <span style={{ color: C.teal }}>{k}</span>
                <span style={{ color: C.amber2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{v}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18, opacity: fadeIn(frame, videoAt - 14, 22) }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px -40px rgba(0,0,0,.95)", background: "#000", aspectRatio: "16 / 9" }}>
          <Sequence from={videoAt} layout="none">
            <OffthreadVideo src={staticFile("xlayer-reel.mp4")} muted style={{ width: "100%", display: "block" }} />
          </Sequence>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontSize: 20, color: C.sub }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: C.amber, boxShadow: `0 0 14px ${C.amber}` }} />
          BUILT FROM A BRIEF · styled from their own logo
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── scene 4: hero image studio ────────────────────────────────────────────

const HeroImage: React.FC = () => {
  const frame = useCurrentFrame();
  const prompt = '"an AI security agent that guards onchain wallets"';
  const imgAt = 72;
  // Gentle push-in only — a bigger scale crops the composited title off the bottom,
  // which is the one thing this scene exists to prove.
  const k = interpolate(frame, [imgAt, imgAt + 300], [1, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const W_IMG = 1080;
  return (
    // own layout (not Stage): the hero panel must never be flex-shrunk, or the
    // bottom of the image — where the title sits — gets clipped away.
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: "124px 120px 168px" }}>
      <Eyebrow delay={2} color={C.teal}>02 · Hero Image Studio · 0.1 USDT</Eyebrow>
      <div style={{ fontFamily: F.mono, fontSize: 28, color: C.amber2, opacity: fadeIn(frame, 10), minHeight: 40, flexShrink: 0 }}>
        {typed(prompt, frame, 14, 44)}
        <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: C.text }}>▌</span>
      </div>
      <div
        style={{
          width: W_IMG,
          height: Math.round((W_IMG * 675) / 1200),
          flexShrink: 0,
          borderRadius: 18,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          boxShadow: "0 44px 100px -44px rgba(0,0,0,.95)",
          opacity: fadeIn(frame, imgAt, 26),
          transform: `translateY(${rise(frame, imgAt, 28, 20)}px)`,
        }}
      >
        <Img src={staticFile("hero-shield.png")} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: `scale(${k})` }} />
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 20, color: C.sub, opacity: fadeIn(frame, imgAt + 40), flexShrink: 0 }}>
        1200 × 675 · title and strapline set in real type
      </div>
    </AbsoluteFill>
  );
};

// ── scene 5: brand kit · restyler · forge ─────────────────────────────────

const Panel: React.FC<{ at: number; label: string; children: React.ReactNode }> = ({ at, label, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        flex: 1,
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 18,
        padding: 30,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(238,241,246,.05), rgba(238,241,246,.015))",
        opacity: fadeIn(frame, at, 18),
        transform: `translateY(${rise(frame, at, 24, 26)}px)`,
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: "0.2em", textTransform: "uppercase", color: C.teal }}>{label}</div>
      {children}
    </div>
  );
};

const ThreeUp: React.FC = () => {
  const frame = useCurrentFrame();
  const swatches = ["#6576ef", "#9fa9f0", "#d5d8ed", "#06070c"];
  return (
    <AbsoluteFill style={{ padding: "150px 90px 190px", flexDirection: "column", gap: 34 }}>
      <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 60, letterSpacing: -1.2, color: C.text, opacity: fadeIn(frame, 2), textAlign: "center" }}>
        And the rest of the kit.
      </div>
      <div style={{ display: "flex", gap: 26, flex: 1 }}>
        <Panel at={16} label="Brand Kit · 0.1">
          <div style={{ display: "flex", gap: 10 }}>
            {swatches.map((c, i) => (
              <div
                key={c}
                style={{
                  flex: 1,
                  height: 96,
                  borderRadius: 12,
                  background: c,
                  border: `1px solid ${C.line}`,
                  opacity: fadeIn(frame, 30 + i * 7, 14),
                }}
              />
            ))}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 20, color: C.text }}>#6576ef</div>
          <div style={{ fontFamily: F.sans, fontSize: 23, color: C.sub, lineHeight: 1.45 }}>
            tokens read straight from the agent's own avatar
          </div>
        </Panel>
        <Panel at={30} label="Restyler · 0.1">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Img src={staticFile("hero-projector.png")} style={{ width: "56%", borderRadius: 10, border: `1px solid ${C.line}` }} />
            <span style={{ fontFamily: F.mono, fontSize: 26, color: C.amber }}>→</span>
            <Img src={staticFile("restyled-square.png")} style={{ width: "34%", borderRadius: 10, border: `1px solid ${C.line}` }} />
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 23, color: C.sub, lineHeight: 1.45 }}>
            subject-aware reframe — no invented pixels
          </div>
        </Panel>
        <Panel at={44} label="Forge · 0.1">
          <div style={{ fontFamily: F.mono, fontSize: 18, lineHeight: 1.75, color: C.sub, background: "rgba(5,7,13,.7)", border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px" }}>
            <div><span style={{ color: C.teal }}>"name"</span>: "First Light",</div>
            <div><span style={{ color: C.teal }}>"image"</span>:</div>
            <div style={{ color: C.amber2, wordBreak: "break-all" }}>"ipfs://bafkreiecqldc23…"</div>
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 23, color: C.sub, lineHeight: 1.45 }}>
            mint-ready metadata, CIDs and hashes
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── scene 6: the settlement proof ─────────────────────────────────────────

const PROOF_ROWS: Array<[string, string, boolean]> = [
  ["scheme", "x402 · exact / aggr_deferred", false],
  ["network", "X Layer · eip155:196", false],
  ["response", "HTTP 200", false],
  ["settlement", "success", true],
];

const Proof: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage gap={40}>
      <Eyebrow delay={2} color={C.teal}>Paid per call · no subscription</Eyebrow>
      <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 66, letterSpacing: -1.3, color: C.text, opacity: fadeIn(frame, 8), textAlign: "center" }}>
        Every call settles onchain.
      </div>
      <div
        style={{
          width: 1080,
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(8,10,16,.9)",
          opacity: fadeIn(frame, 26, 20),
          transform: `translateY(${rise(frame, 26, 24, 20)}px)`,
        }}
      >
        {PROOF_ROWS.map(([k, v, good], i) => {
          const at = 22 + i * 10;
          const pulse = good ? 0.75 + 0.25 * Math.sin((frame - at) / 7) : 1;
          return (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "24px 34px",
                borderBottom: i < PROOF_ROWS.length - 1 ? `1px solid ${C.line}` : "none",
                opacity: fadeIn(frame, at, 14),
              }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color: C.mute }}>{k}</span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 27,
                  color: good ? C.teal : C.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: good ? pulse : 1,
                }}
              >
                {good ? <span style={{ width: 11, height: 11, borderRadius: 999, background: C.teal, boxShadow: `0 0 16px ${C.teal}` }} /> : null}
                {v}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: F.sans, fontSize: 26, color: C.sub, opacity: fadeIn(frame, 110), textAlign: "center" }}>
        Your wallet signs. Nothing is ever handed over.
      </div>
    </Stage>
  );
};

// ── scene 7: the close ────────────────────────────────────────────────────

const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 30], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <Stage gap={30}>
      <div style={{ opacity: fadeIn(frame, 0, 22), transform: `scale(${s})` }}>
        <Mark size={168} />
      </div>
      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 700,
          fontSize: 96,
          letterSpacing: -2,
          color: C.text,
          opacity: fadeIn(frame, 22, 22),
        }}
      >
        Agent<span style={{ color: C.amber }}> Reel</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 30, letterSpacing: "0.2em", color: C.sub, opacity: fadeIn(frame, 44, 22) }}>
        AGENT #6731 · OKX.AI
      </div>
      <div style={{ fontFamily: F.sans, fontSize: 28, color: C.teal, opacity: fadeIn(frame, 66, 22), textAlign: "center" }}>
        This video was made by the product.
      </div>
    </Stage>
  );
};

// ── scene 9: the proof wall (silent tail) ─────────────────────────────────

/** Every real artefact, snapping into a wall — then the lockup lands on top. */
const Wall: React.FC = () => {
  const frame = useCurrentFrame();
  const tiles: Array<{ src: string; video?: boolean }> = [
    { src: "hero-projector.png" },
    { src: "scoutgate-reel.mp4", video: true },
    { src: "hero-shield.png" },
    { src: "restyled-square.png" },
    { src: "xlayer-reel.mp4", video: true },
    { src: "launch-reel.mp4", video: true },
  ];
  const lockAt = 62;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ padding: 80, display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 20, alignContent: "center", justifyContent: "center" }}>
        {tiles.map((t, i) => {
          const at = 4 + i * 6;
          const o = fadeIn(frame, at, 10) * interpolate(frame, [lockAt, lockAt + 26], [1, 0.09], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={t.src}
              style={{
                width: 560,
                borderRadius: 14,
                overflow: "hidden",
                border: `1px solid ${C.line}`,
                background: "#000",
                opacity: o,
                transform: `scale(${interpolate(frame, [at, at + 16], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })})`,
              }}
            >
              {t.video ? (
                <OffthreadVideo src={staticFile(t.src)} startFrom={90} muted style={{ width: "100%", display: "block" }} />
              ) : (
                <Img src={staticFile(t.src)} style={{ width: "100%", display: "block" }} />
              )}
            </div>
          );
        })}
      </AbsoluteFill>
      {/* near-opaque scrim so the lockup never fights the tiles behind it */}
      <AbsoluteFill style={{ background: "radial-gradient(72% 64% at 50% 50%, rgba(5,7,13,.99) 0%, rgba(5,7,13,.96) 62%, rgba(5,7,13,.86) 100%)", opacity: fadeIn(frame, lockAt, 24) }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeIn(frame, lockAt + 6, 22) }}>
        {/* the lockup lands on its own solid card — zero bleed-through from the wall */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            padding: "58px 96px 52px",
            borderRadius: 26,
            background: "#05070d",
            border: `1px solid ${C.line}`,
            boxShadow: "0 50px 130px -30px rgba(0,0,0,1)",
          }}
        >
          <Mark size={116} />
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 76, letterSpacing: -1.6, color: C.text }}>
            Agent<span style={{ color: C.amber }}> Reel</span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 26, letterSpacing: "0.2em", color: C.sub }}>AGENT #6731 · OKX.AI</div>
          <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.12em", color: C.teal, marginTop: 4 }}>
            every frame behind this: a real paid delivery
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── the film ──────────────────────────────────────────────────────────────

export const Demo: React.FC<DemoProps> = ({ beats, captions, reelPlayFrom, vo }) => {
  const { durationInFrames } = useVideoConfig();
  const b = beats;
  const span = (i: number) => (i + 1 < b.length ? b[i + 1] - b[i] : durationInFrames - b[i]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <Audio src={staticFile(vo)} />
      <Ground />

      <Sequence from={b[0]} durationInFrames={span(0)}>
        <Cut dur={span(0)}><Hook /></Cut>
      </Sequence>
      <Sequence from={b[1]} durationInFrames={span(1)}>
        <Cut dur={span(1)}><Services /></Cut>
      </Sequence>
      <Sequence from={b[2]} durationInFrames={span(2)}>
        <Cut dur={span(2)}><PromoReel playFrom={reelPlayFrom - b[2]} /></Cut>
      </Sequence>
      <Sequence from={b[3]} durationInFrames={span(3)}>
        <Cut dur={span(3)}><CustomBrief /></Cut>
      </Sequence>
      <Sequence from={b[4]} durationInFrames={span(4)}>
        <Cut dur={span(4)}><HeroImage /></Cut>
      </Sequence>
      <Sequence from={b[5]} durationInFrames={span(5)}>
        <Cut dur={span(5)}><ThreeUp /></Cut>
      </Sequence>
      <Sequence from={b[6]} durationInFrames={span(6)}>
        <Cut dur={span(6)}><Proof /></Cut>
      </Sequence>
      <Sequence from={b[7]} durationInFrames={span(7)}>
        <Cut dur={span(7)}><Close /></Cut>
      </Sequence>
      <Sequence from={b[8]} durationInFrames={span(8)}>
        <Cut dur={span(8)}><Wall /></Cut>
      </Sequence>

      {/* chrome sits above the scenes but below captions; hidden on the close */}
      <Sequence from={0} durationInFrames={b[7]}>
        <Chrome />
      </Sequence>
      <Captions captions={captions} />

      {/* grain */}
      <AbsoluteFill
        style={{
          opacity: 0.045,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>\")",
        }}
      />
    </AbsoluteFill>
  );
};
