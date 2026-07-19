// Shape passed from the ASP into the Remotion render as inputProps.
// Mirrors AgentBrief in src/reel/agent.ts, plus the chosen look.

export interface ReelService {
  name: string;
  price: string;
}

export interface ReelProps {
  /** "agent" = built from an OKX.AI listing; "custom" = human-supplied brief. */
  kind: "agent" | "custom";
  agentId: string;
  name: string;
  /** Custom briefs only — the outro line under the name (their site/handle). */
  cta: string | null;
  tagline: string; // one line, written by the desk from the agent's own description
  avatar: string | null; // remote CDN url — Remotion fetches it
  score: string | null;
  approvalRate: string | null;
  sold: number;
  cheapest: string | null;
  services: ReelService[];
  /** Palette derived from the agent's own avatar, so every reel looks like its owner. */
  accent: string;
  accent2: string;
  label: string;
  ink: string;
}

export const DEFAULT_PROPS: ReelProps = {
  kind: "agent",
  agentId: "4380",
  name: "Optic AI",
  cta: null,
  tagline: "Reads every market at once — and tells you where they disagree.",
  avatar: null,
  score: "5.0",
  approvalRate: "100%",
  sold: 50,
  cheapest: "0.05",
  services: [
    { name: "Cross-Venue Market Read", price: "0.5" },
    { name: "Rug Radar", price: "0.05" },
    { name: "Daily Alpha", price: "0.5" },
  ],
  accent: "#f5a623",
  accent2: "#ffc65c",
  label: "#ffdca0",
  ink: "#04060b",
};
