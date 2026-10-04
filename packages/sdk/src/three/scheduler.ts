export { clampDt } from "../lib/frame-time";

export type LoopInputs = {
  animate: boolean;
  visible: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
};
export type LoopState = "running" | "paused";

export const loopState = (i: LoopInputs): LoopState =>
  i.animate && i.visible && i.documentVisible && !i.reducedMotion ? "running" : "paused";
