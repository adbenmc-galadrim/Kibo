export const clampDt = (previous: number | null, now: number, max = 0.1): number =>
  previous === null ? 0 : Math.min(max, Math.max(0, (now - previous) / 1000));
