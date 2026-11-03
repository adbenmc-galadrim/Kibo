export const REPLAY_WINDOW_MS = 600_000;
const REPLAY_MAX_IDS = 1_000;

export type ReplayGuard = { seen(requestId: string, at: number): boolean; size(): number };

export function createReplayGuard(windowMs = REPLAY_WINDOW_MS, max = REPLAY_MAX_IDS): ReplayGuard {
  const ids = new Map<string, number>();
  const forgetBefore = (limit: number) => {
    for (const [id, at] of ids) if (at < limit) ids.delete(id);
  };
  const keepNewest = () => {
    for (const id of ids.keys()) {
      if (ids.size <= max) return;
      ids.delete(id);
    }
  };
  return {
    seen(requestId, at) {
      forgetBefore(at - windowMs);
      if (ids.has(requestId)) return true;
      ids.set(requestId, at);
      keepNewest();
      return false;
    },
    size: () => ids.size,
  };
}
