import type { GraphEdge } from "./critical-path";

function successors(edges: readonly GraphEdge[]): Map<string, Set<string>> {
  const succ = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.type !== "blocks" || e.from === e.to) continue;
    const set = succ.get(e.from) ?? new Set<string>();
    set.add(e.to);
    succ.set(e.from, set);
  }
  return succ;
}

function reachableFrom(succ: ReadonlyMap<string, ReadonlySet<string>>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(succ.get(start) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    stack.push(...(succ.get(id) ?? []));
  }
  return seen;
}

export function reduceTransitive(edges: readonly GraphEdge[]): { kept: GraphEdge[]; implied: GraphEdge[] } {
  const succ = successors(edges);
  const reach = new Map<string, Set<string>>();
  const reachOf = (id: string): Set<string> => {
    const known = reach.get(id);
    if (known) return known;
    const computed = reachableFrom(succ, id);
    reach.set(id, computed);
    return computed;
  };
  const isImplied = (e: GraphEdge): boolean =>
    e.type === "blocks" &&
    [...(succ.get(e.from) ?? [])].some((via) => via !== e.to && reachOf(via).has(e.to));
  const kept: GraphEdge[] = [];
  const implied: GraphEdge[] = [];
  for (const e of edges) (isImplied(e) ? implied : kept).push(e);
  return { kept, implied };
}
