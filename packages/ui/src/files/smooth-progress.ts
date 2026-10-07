const EASING_MS = 120;
const SNAP = 0.002;

export const raise = (shown: number, ratio: number): number =>
  Number.isNaN(ratio) ? shown : Math.min(1, Math.max(shown, ratio));

export function stepToward(shown: number, target: number, elapsedMs: number): number {
  if (target <= shown) return shown;
  const next = shown + (target - shown) * (1 - Math.exp(-elapsedMs / EASING_MS));
  return target - next < SNAP ? target : next;
}
