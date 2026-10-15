import { isGroup, type TicketView } from "@kibo/schema";
import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { groupNodeId } from "./groups";

export const ENSEMBLE_PREFIX = "ensemble";

export type EnsembleInfo = { name: string; label: string; compact: string };
export type EnsembleIndex = {
  groupOf: ReadonlyMap<string, string>;
  info: ReadonlyMap<string, EnsembleInfo>;
};

export const NO_ENSEMBLES: EnsembleIndex = { groupOf: new Map(), info: new Map() };

export function ensembleIndex(tickets: readonly TicketView[]): EnsembleIndex {
  const groups = tickets.filter(isGroup);
  if (groups.length === 0) return NO_ENSEMBLES;
  const ids = new Set(groups.map((g) => g.id));
  const groupOf = new Map<string, string>();
  for (const t of tickets) if (t.parentId !== null && ids.has(t.parentId)) groupOf.set(t.id, t.parentId);
  const info = new Map(
    groups.map((g): [string, EnsembleInfo] => [
      g.id,
      {
        name: g.keyLabel,
        label: fr.ensembleLabel(g.keyLabel, g.title, g.progress.done, g.progress.total),
        compact: fr.ensembleCompact(g.keyLabel, g.progress.done, g.progress.total),
      },
    ]),
  );
  return { groupOf, info };
}

const frameOfGroup = (id: string, index: EnsembleIndex): string =>
  index.info.has(id) ? groupNodeId(ENSEMBLE_PREFIX, id) : id;

function within(index: EnsembleIndex, id: string, group: string): boolean {
  const seen = new Set<string>();
  for (let at = index.groupOf.get(id); at !== undefined && !seen.has(at); at = index.groupOf.get(at)) {
    if (at === group) return true;
    seen.add(at);
  }
  return false;
}

export function ensembleEdges(edges: readonly GraphEdge[], index: EnsembleIndex): GraphEdge[] {
  return edges
    .filter((e) => !within(index, e.from, e.to) && !within(index, e.to, e.from))
    .map((e) => ({ ...e, from: frameOfGroup(e.from, index), to: frameOfGroup(e.to, index) }));
}

function leavesOf(index: EnsembleIndex, group: string): string[] {
  const out: string[] = [];
  const visit = (id: string, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const [child, parent] of index.groupOf) {
      if (parent !== id) continue;
      if (index.info.has(child)) visit(child, seen);
      else out.push(child);
    }
  };
  visit(group, new Set());
  return out;
}

export function layeringEdges(edges: readonly GraphEdge[], index: EnsembleIndex): GraphEdge[] {
  const ends = (id: string) => (index.info.has(id) ? leavesOf(index, id) : [id]);
  return edges
    .filter((e) => !within(index, e.from, e.to) && !within(index, e.to, e.from))
    .flatMap((e) => ends(e.from).flatMap((from) => ends(e.to).map((to) => ({ ...e, from, to }))));
}
