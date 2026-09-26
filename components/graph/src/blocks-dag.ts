import type { GraphEdge, GraphTicket } from "./critical-path";

export type BlocksDag = { order: string[]; succ: Map<string, string[]>; pred: Map<string, string[]> };

export function compareKeys(a: string | null, b: string | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const [pa = "", na = "0"] = a.split("-");
  const [pb = "", nb = "0"] = b.split("-");
  if (pa !== pb) return pa < pb ? -1 : 1;
  return Number(na) - Number(nb);
}

export function sortTickets(tickets: GraphTicket[]): GraphTicket[] {
  return [...tickets].sort((a, b) => compareKeys(a.key, b.key) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const push = (map: Map<string, string[]>, key: string, value: string) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export function blocksDag(sorted: GraphTicket[], edges: GraphEdge[]): BlocksDag {
  const rank = new Map(sorted.map((t, i) => [t.id, i]));
  const raw = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "blocks" || e.from === e.to || !rank.has(e.from) || !rank.has(e.to)) continue;
    if (!raw.get(e.from)?.includes(e.to)) push(raw, e.from, e.to);
  }
  for (const list of raw.values()) list.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  const state = new Map<string, "open" | "closed">();
  const succ = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  const postorder: string[] = [];
  for (const root of sorted) {
    if (state.has(root.id)) continue;
    state.set(root.id, "open");
    const stack: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      const targets = raw.get(frame.id) ?? [];
      const target = targets[frame.next];
      if (target === undefined) {
        state.set(frame.id, "closed");
        postorder.push(frame.id);
        stack.pop();
        continue;
      }
      frame.next += 1;
      const seen = state.get(target);
      if (seen === "open") continue;
      push(succ, frame.id, target);
      push(pred, target, frame.id);
      if (seen === undefined) {
        state.set(target, "open");
        stack.push({ id: target, next: 0 });
      }
    }
  }
  return { order: postorder.reverse(), succ, pred };
}
