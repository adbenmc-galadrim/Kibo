import type { GraphEdge } from "./critical-path";

function walk(next: ReadonlyMap<string, string[]>, id: string, depth: number): Set<string> {
  const seen = new Set<string>();
  let frontier = [id];
  for (let level = 0; level < depth && frontier.length > 0; level += 1) {
    const following: string[] = [];
    for (const current of frontier) {
      for (const n of next.get(current) ?? []) {
        if (n === id || seen.has(n)) continue;
        seen.add(n);
        following.push(n);
      }
    }
    frontier = following;
  }
  return seen;
}

export function focusSet(
  edges: readonly GraphEdge[],
  id: string,
  depth: 2,
): { up: Set<string>; down: Set<string> } {
  const succ = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "blocks") continue;
    succ.set(e.from, [...(succ.get(e.from) ?? []), e.to]);
    pred.set(e.to, [...(pred.get(e.to) ?? []), e.from]);
  }
  return { up: walk(pred, id, depth), down: walk(succ, id, depth) };
}
