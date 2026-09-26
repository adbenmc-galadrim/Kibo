export type RateLimitGate = { observe(headers: Headers): void; blockedUntil(): number | null };
export const GITHUB_RATE_FLOOR = 100;

export function createRateLimitGate(now: () => number): RateLimitGate {
  let until: number | null = null;
  return {
    observe(headers) {
      const retryAfter = Number(headers.get("retry-after"));
      if (headers.has("retry-after") && Number.isFinite(retryAfter)) {
        until = now() + retryAfter * 1000;
        return;
      }
      const remaining = Number(headers.get("x-ratelimit-remaining"));
      const reset = Number(headers.get("x-ratelimit-reset"));
      if (!headers.has("x-ratelimit-remaining") || !Number.isFinite(remaining)) return;
      if (remaining < GITHUB_RATE_FLOOR && Number.isFinite(reset)) until = reset * 1000;
      else if (remaining >= GITHUB_RATE_FLOOR) until = null;
    },
    blockedUntil: () => (until !== null && until > now() ? until : null),
  };
}
