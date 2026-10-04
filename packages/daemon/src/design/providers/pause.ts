export type RatePause = {
  active(): boolean;
  until(): number | null;
  set(retryAfterSeconds: number | null): void;
};

export function createRatePause(now: () => number, minMs = 60_000): RatePause {
  let until: number | null = null;
  return {
    active: () => until !== null && now() < until,
    until: () => until,
    set(retryAfterSeconds) {
      const next = now() + Math.max(minMs, (retryAfterSeconds ?? 0) * 1000);
      until = until === null ? next : Math.max(until, next);
    },
  };
}

export function retryAfterSeconds(headers: Headers): number | null {
  const value = Number(headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? value : null;
}
