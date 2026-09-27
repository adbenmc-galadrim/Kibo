export const FIRST_CHECK_DELAY_MS = 10_000;
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export type Timers<Id = ReturnType<typeof setTimeout>> = {
  setTimeout(fn: () => void, ms: number): Id;
  clearTimeout(id: Id): void;
  setInterval(fn: () => void, ms: number): Id;
  clearInterval(id: Id): void;
};

const globalTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

export function scheduleUpdateChecks<Id>(check: () => void, timers: Timers<Id>): () => void;
export function scheduleUpdateChecks(check: () => void): () => void;
export function scheduleUpdateChecks<Id>(check: () => void, timers?: Timers<Id>): () => void {
  const clock: Timers<Id | ReturnType<typeof setTimeout>> = timers ?? globalTimers;
  let interval: Id | ReturnType<typeof setTimeout> | null = null;
  let delay: Id | ReturnType<typeof setTimeout> | null = clock.setTimeout(() => {
    delay = null;
    check();
    interval = clock.setInterval(check, CHECK_EVERY_MS);
  }, FIRST_CHECK_DELAY_MS);
  return () => {
    if (delay !== null) clock.clearTimeout(delay);
    if (interval !== null) clock.clearInterval(interval);
    delay = null;
    interval = null;
  };
}
