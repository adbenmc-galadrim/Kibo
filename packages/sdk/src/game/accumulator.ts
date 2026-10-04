export const FIXED_STEP = 1 / 60;

export function stepAccumulator(
  acc: number,
  dt: number,
  fixed = FIXED_STEP,
  maxSteps = 5,
): { steps: number; rest: number } {
  const total = acc + dt;
  const steps = Math.min(maxSteps, Math.floor(total / fixed));
  return { steps, rest: steps === maxSteps ? 0 : total - steps * fixed };
}
