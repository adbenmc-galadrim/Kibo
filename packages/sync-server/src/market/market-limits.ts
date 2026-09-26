import { FailureLimiter, RateWindow } from "../limits";

export const MARKET_LIMITS = {
  authFailures: 10,
  failureWindowMs: 60_000,
  blockMs: 300_000,
  writesPerWindow: 30,
  writeWindowMs: 60_000,
} as const;

export type MarketLimits = { failures: FailureLimiter; writes: RateWindow };

export function createMarketLimits(now: () => number): MarketLimits {
  return {
    failures: new FailureLimiter({
      max: MARKET_LIMITS.authFailures,
      windowMs: MARKET_LIMITS.failureWindowMs,
      blockMs: MARKET_LIMITS.blockMs,
      now,
    }),
    writes: new RateWindow({
      limit: MARKET_LIMITS.writesPerWindow,
      windowMs: MARKET_LIMITS.writeWindowMs,
      now,
    }),
  };
}
