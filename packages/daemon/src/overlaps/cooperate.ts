import type { Steps } from "@kibo/core";

export const SLICE_MS = 10;

const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export function pacer(sliceMs = SLICE_MS): () => Promise<void> {
  let since = performance.now();
  return async () => {
    if (performance.now() - since < sliceMs) return;
    await nextTurn();
    since = performance.now();
  };
}

export async function cooperate<T>(steps: Steps<T>, sliceMs = SLICE_MS): Promise<T> {
  const pace = pacer(sliceMs);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
    await pace();
  }
}
