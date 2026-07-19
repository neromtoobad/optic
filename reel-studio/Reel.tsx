import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import type { ReelProps } from "../src/reel/props";

// 15s @ 30fps = 450 frames.
//   0- 90  the mark      — avatar + name, lands on beat
//  90-180  the pitch     — one line, its own moment
// 180-300  the menu      — real services, real prices, staggered
// 300-390  the proof     — score / sold / approval, only what exists
// 390-450  the call      — agent id + marketplace
const EASE = [0.16, 1, 0.3, 1] as const;

const F = {
  sans: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** Ground: the agent's own accent, breathing. */
const Ground: React.FC<{ p: ReelProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: p.ink }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
          backgroundSize: "76px 76px",
          maskImage: "radial-gradient(72% 62% at 50% 46%, #000 0%, transparent 88%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(50% 40% at 78% -8%, ${p.accent}2e, transparent 62%)`,
          opacity: interpolate(frame, [0, 225, 450], [0.7, 1, 0.7]),
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 380px 120px rgba(0,0,0,.85)" }} />
    </AbsoluteFill>
  );
};

const Beat: React.FC<{ children: React.ReactNode; gap?: number }> = ({
  children,
  gap = 34,
}) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap,
      padding: "110px 140px",
      textAlign: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

const Mark: React.FC<{ p: ReelProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const rise = (at: number) => ({
    opacity: interpolate(frame, [at, at + 22], [0, 1], {
      extrapolateLeft: "clamp" as const,
      extrapolateRight: "clamp" as const,
      easing: Easing.bezier(...EASE),
    }),
    translate: interpolate(frame, [at, at + 22], ["0px 26px", "0px 0px"], {
      extrapolateLeft: "clamp" as const,
      extrapolateRight: "clamp" as const,
      easing: Easing.bezier(...EASE),
    }),
  });
  return (
    <Beat gap={38}>
      {p.avatar ? (
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 34,
            overflow: "hidden",
            border: `2px solid ${p.accent}55`,
            boxShadow: `0 0 90px ${p.accent}44`,
            ...rise(4),
            scale: String(
              interpolate(frame, [4, 30], [0.86, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(...EASE),
              }),
            ),
          }}
        >
          <Img
            src={p.avatar}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 700,
          fontSize: 108,
          letterSpacing: "-0.01em",
          color: "#fff",
          ...rise(26),
        }}
      >
        {p.name}
      </div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 27,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color: p.label,
          ...rise(44),
        }}
      >
        Agent #{p.agentId} · Live on OKX.AI
      </div>
    </Beat>
  );
};

const Pitch: React.FC<{ p: ReelProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  return (
    <Beat>
      <div
        style={{
          maxWidth: 1420,
          fontFamily: F.sans,
          fontWeight: 500,
          fontSize: 76,
          lineHeight: 1.24,
          color: "#fff",
          opacity: interpolate(frame, [0, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(...EASE),
          }),
          translate: interpolate(frame, [0, 24], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(...EASE),
          }),
        }}
      >
        {p.tagline}
      </div>
    </Beat>
  );
};

const Menu: React.FC<{ p: ReelProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const rows = p.services.slice(0, 5);
  return (
    <Beat gap={26}>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 25,
          letterSpacing: "0.38em",
          textTransform: "uppercase",
          color: p.label,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {rows.length === 1 ? "What it does" : `${p.services.length} services`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 1300 }}>
        {rows.map((s, i) => {
          const at = 22 + i * 16;
          return (
            <div
              key={s.name}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 40,
                paddingBottom: 14,
                borderBottom: "1px solid rgba(255,255,255,.10)",
                opacity: interpolate(frame, [at, at + 18], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(...EASE),
                }),
                translate: interpolate(frame, [at, at + 18], ["0px 16px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(...EASE),
                }),
              }}
            >
              <span
                style={{
                  fontFamily: F.sans,
                  fontWeight: 500,
                  fontSize: 46,
                  color: "#fff",
                  textAlign: "left",
                }}
              >
                {s.name}
              </span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 34,
                  color: p.accent2,
                  whiteSpace: "nowrap",
                }}
              >
                {s.price} USDT
              </span>
            </div>
          );
        })}
      </div>
    </Beat>
  );
};

const Proof: React.FC<{ p: ReelProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  // Only render stats that actually exist — a new agent shows nothing rather than zeros.
  // The score gets an inline SVG star, not the ★ glyph: U+2605 isn't in the bundled
  // fonts, so in the Linux render container it fell back to a tofu box. SVG renders
  // identically everywhere.
  const stats = [
    p.score ? { n: p.score, l: "SCORE", star: true } : null,
    p.sold > 0 ? { n: String(p.sold), l: "SOLD", star: false } : null,
    p.approvalRate ? { n: p.approvalRate, l: "POSITIVE", star: false } : null,
  ].filter(Boolean) as Array<{ n: string; l: string; star: boolean }>;

  if (!stats.length) {
    return (
      <Beat>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 84, color: "#fff" }}>
          Newly listed.
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 30, color: p.accent }}>
          Be the first to hire it.
        </div>
      </Beat>
    );
  }

  return (
    <Beat gap={30}>
      <div style={{ display: "flex", gap: 76 }}>
        {stats.map((s, i) => {
          const at = 6 + i * 16;
          return (
            <div
              key={s.l}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                minWidth: 300,
                opacity: interpolate(frame, [at, at + 22], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(...EASE),
                }),
                scale: String(
                  interpolate(frame, [at, at + 22], [0.9, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(...EASE),
                  }),
                ),
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: F.sans,
                  fontWeight: 700,
                  fontSize: 132,
                  lineHeight: 1,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.n}
                {s.star ? (
                  <svg width="92" height="92" viewBox="0 0 24 24" fill={p.accent2}>
                    <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 7.1-1.01z" />
                  </svg>
                ) : null}
              </span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 25,
                  letterSpacing: "0.3em",
                  color: p.label,
                }}
              >
                {s.l}
              </span>
            </div>
          );
        })}
      </div>
      {p.cheapest ? (
        <div
          style={{
            fontFamily: F.sans,
            fontSize: 46,
            color: "rgba(255,255,255,.72)",
            opacity: interpolate(frame, [58, 82], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          from {p.cheapest} USDT per call
        </div>
      ) : null}
    </Beat>
  );
};

const Call: React.FC<{ p: ReelProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  return (
    <Beat gap={26}>
      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 700,
          fontSize: 92,
          color: "#fff",
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(...EASE),
          }),
          scale: String(
            interpolate(frame, [0, 24], [0.95, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...EASE),
            }),
          ),
        }}
      >
        Hire it on OKX.AI
      </div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 34,
          letterSpacing: "0.16em",
          color: p.accent,
          opacity: interpolate(frame, [22, 44], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        okx.ai/agents/{p.agentId}
      </div>
    </Beat>
  );
};

/** Fades each beat in/out so hard cuts never flash. */
const Cut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [0, 9, dur - 9, dur], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = (p) => (
  <AbsoluteFill>
    <Sequence name="Ground">
      <Ground p={p} />
    </Sequence>
    <Sequence name="1 Mark" durationInFrames={90}>
      <Cut dur={90}>
        <Mark p={p} />
      </Cut>
    </Sequence>
    <Sequence name="2 Pitch" from={90} durationInFrames={90}>
      <Cut dur={90}>
        <Pitch p={p} />
      </Cut>
    </Sequence>
    <Sequence name="3 Menu" from={180} durationInFrames={120}>
      <Cut dur={120}>
        <Menu p={p} />
      </Cut>
    </Sequence>
    <Sequence name="4 Proof" from={300} durationInFrames={90}>
      <Cut dur={90}>
        <Proof p={p} />
      </Cut>
    </Sequence>
    <Sequence name="5 Call" from={390} durationInFrames={60}>
      <Cut dur={60}>
        <Call p={p} />
      </Cut>
    </Sequence>
  </AbsoluteFill>
);
