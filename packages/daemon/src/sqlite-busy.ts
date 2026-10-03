import type { Database } from "bun:sqlite";

export const SQLITE_BUSY_TIMEOUT_MS = 5_000;

export function immediateTransaction<A extends unknown[], R>(
  db: Database,
  fn: (...args: A) => R,
): (...args: A) => R {
  const tx = db.transaction(fn);
  return (...args) => tx.immediate(...args);
}
