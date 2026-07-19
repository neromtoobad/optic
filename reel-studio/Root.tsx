import "./fonts.css";
import React from "react";
import { Composition } from "remotion";
import { Reel } from "./Reel";
import { DEFAULT_PROPS } from "../src/reel/props";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={450}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={DEFAULT_PROPS}
  />
);
