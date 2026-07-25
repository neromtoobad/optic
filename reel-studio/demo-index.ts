// Separate entry for the submission demo, so the production reel service's own
// entry (index.ts → Root.tsx) stays untouched.
import "./fonts.css";
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Demo, DEMO_DEFAULTS } from "./Demo";

const DemoRoot: React.FC = () =>
  React.createElement(Composition, {
    id: "Demo",
    component: Demo,
    durationInFrames: 2700, // 90s @ 30fps
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: DEMO_DEFAULTS,
  });

registerRoot(DemoRoot);
