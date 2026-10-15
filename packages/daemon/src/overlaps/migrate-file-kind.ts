import type { OverlapStore } from "./store";

export function resolveFileOverlaps(store: Pick<OverlapStore, "list" | "event">, at: number): number {
  const open = store.list({ kind: "file", state: "open" });
  for (const o of open) store.event(o.id, { type: "resolved", role: null, by: null, at });
  return open.length;
}
