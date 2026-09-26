export type QuotaKind = "call" | "fetch" | "mcp";
export type Quotas = { take(instanceId: string, kind: QuotaKind): boolean };

export function createQuotas(
  opts: { now?: () => number; callsPerSecond?: number; fetchPerMinute?: number; mcpPerMinute?: number } = {},
): Quotas {
  const now = opts.now ?? Date.now;
  const limits = {
    call: { max: opts.callsPerSecond ?? 200, window: 1_000 },
    fetch: { max: opts.fetchPerMinute ?? 20, window: 60_000 },
    mcp: { max: opts.mcpPerMinute ?? 30, window: 60_000 },
  };
  const seen = new Map<string, number[]>();
  return {
    take(instanceId, kind) {
      const { max, window } = limits[kind];
      const key = `${kind}:${instanceId}`;
      const t = now();
      const recent = (seen.get(key) ?? []).filter((at) => t - at < window);
      if (recent.length >= max) {
        seen.set(key, recent);
        return false;
      }
      recent.push(t);
      seen.set(key, recent);
      return true;
    },
  };
}
