export const REPLAY_WINDOW_MS = 600_000;
const REPLAY_MAX_IDS = 1_000;

export type ReplayGuard = { seen(requestId: string, at: number, now: number): boolean; size(): number };

export function createReplayGuard(windowMs = REPLAY_WINDOW_MS, max = REPLAY_MAX_IDS): ReplayGuard {
  const expiries = new Map<string, number>();
  const forgetExpired = (now: number) => {
    for (const [id, expiry] of expiries) if (expiry < now) expiries.delete(id);
  };
  const keepNewest = () => {
    for (const id of expiries.keys()) {
      if (expiries.size <= max) return;
      expiries.delete(id);
    }
  };
  return {
    seen(requestId, at, now) {
      forgetExpired(now);
      if (expiries.has(requestId)) return true;
      expiries.set(requestId, at + windowMs);
      keepNewest();
      return false;
    },
    size: () => expiries.size,
  };
}
