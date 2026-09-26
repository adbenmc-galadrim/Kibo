export type RateLimitGate = { observe(headers: Headers): void; blockedUntil(): number | null };
export const GITHUB_RATE_FLOOR = 100;

const WATCHED_RESOURCES = new Set(["core", "graphql"]);

function pauseEnd(headers: Headers, now: number): number | null {
  const retryAfter = Number(headers.get("retry-after"));
  if (headers.has("retry-after") && Number.isFinite(retryAfter)) return now + retryAfter * 1000;
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (!headers.has("x-ratelimit-remaining") || !Number.isFinite(remaining)) return null;
  return remaining < GITHUB_RATE_FLOOR && Number.isFinite(reset) ? reset * 1000 : null;
}

export function createRateLimitGate(now: () => number): RateLimitGate {
  let until: number | null = null;
  return {
    observe(headers) {
      const resource = headers.get("x-ratelimit-resource");
      if (resource !== null && !WATCHED_RESOURCES.has(resource)) return;
      const end = pauseEnd(headers, now());
      if (end !== null) until = Math.max(until ?? end, end);
    },
    blockedUntil: () => (until !== null && until > now() ? until : null),
  };
}
