import type { Database } from "bun:sqlite";

type RateLimitPolicy = { maxFailures: number; windowMs: number; blockMs: number };

type RateLimit = {
  blocked(): boolean;
  fail(): boolean;
  succeed(): void;
};

export const AUTH_POLICY: RateLimitPolicy = { maxFailures: 5, windowMs: 10 * 60_000, blockMs: 5 * 60_000 };

type Row = { failures: number; window_start: number; blocked_until: number };

export function createRateLimit(
  db: Database,
  scope: string,
  policy: RateLimitPolicy,
  now: () => number,
): RateLimit {
  const read = db.query<Row, [string]>(
    "SELECT failures, window_start, blocked_until FROM rate_limits WHERE scope = ?",
  );
  const write = (row: Row) =>
    db.run(
      `INSERT INTO rate_limits (scope, failures, window_start, blocked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT (scope) DO UPDATE SET failures = excluded.failures,
         window_start = excluded.window_start, blocked_until = excluded.blocked_until`,
      [scope, row.failures, row.window_start, row.blocked_until],
    );
  const blocked = () => (read.get(scope)?.blocked_until ?? 0) > now();
  return {
    blocked,
    fail: () => {
      const at = now();
      const row = read.get(scope);
      const fresh = !row || at - row.window_start >= policy.windowMs;
      const failures = fresh ? 1 : row.failures + 1;
      if (failures >= policy.maxFailures) {
        write({ failures: 0, window_start: at, blocked_until: at + policy.blockMs });
        return true;
      }
      write({
        failures,
        window_start: fresh ? at : row.window_start,
        blocked_until: row?.blocked_until ?? 0,
      });
      return false;
    },
    succeed: () => {
      db.run("DELETE FROM rate_limits WHERE scope = ?", [scope]);
    },
  };
}
