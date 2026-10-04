export type LoopInputs = {
  animate: boolean;
  visible: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
};
export type LoopState = "running" | "paused";

export const loopState = (i: LoopInputs): LoopState =>
  i.animate && i.visible && i.documentVisible && !i.reducedMotion ? "running" : "paused";

export const clampDt = (previous: number | null, now: number, max = 0.1): number =>
  previous === null ? 0 : Math.min(max, Math.max(0, (now - previous) / 1000));
