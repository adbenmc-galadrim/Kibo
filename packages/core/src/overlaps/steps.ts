export type Steps<T> = Generator<void, T, void>;

export const STEP_UNITS = 512;

export function finish<T>(steps: Steps<T>): T {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

export function stepCounter(): () => boolean {
  let units = 0;
  return () => {
    units += 1;
    if (units < STEP_UNITS) return false;
    units = 0;
    return true;
  };
}
