import type { GraphEdge } from "./critical-path";
import type { EnsembleIndex } from "./ensembles";
import { fr } from "./fr";
import type { WaveTicket } from "./waves";

export type GroupSpec = { prefix: string; collapsed: ReadonlySet<string>; ensembles?: EnsembleIndex };
type Labelled = { labels: readonly string[] };
type Member = Labelled & { id: string };

const SEPARATOR = ":";
const GROUP_ID_PREFIX = "group";
const compareValues = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true });

const splitLabel = (label: string): [string, string] | null => {
  const at = label.indexOf(SEPARATOR);
  if (at <= 0 || at === label.length - 1) return null;
  return [label.slice(0, at), label.slice(at + 1)];
};

const labelValue = (t: Labelled, prefix: string): string | null => {
  for (const label of t.labels) {
    const parts = splitLabel(label);
    if (parts && parts[0] === prefix) return parts[1];
  }
  return null;
};

const groupValue = (t: Member, spec: GroupSpec): string | null =>
  spec.ensembles ? (spec.ensembles.groupOf.get(t.id) ?? null) : labelValue(t, spec.prefix);

export const frameName = (spec: GroupSpec, value: string): string =>
  spec.ensembles?.info.get(value)?.name ?? value;

export const frameLabel = (spec: GroupSpec, value: string, count: number): string =>
  spec.ensembles?.info.get(value)?.label ?? fr.groupLabel(value, count);

const nodeLabel = (spec: GroupSpec, value: string, count: number): string =>
  spec.ensembles?.info.get(value)?.compact ?? fr.groupLabel(value, count);

export const isGroupNode = (id: string): boolean => id.startsWith(`${GROUP_ID_PREFIX}${SEPARATOR}`);

export const groupNodeId = (prefix: string, value: string): string => `${GROUP_ID_PREFIX}:${prefix}:${value}`;

export function labelPrefixes(tickets: readonly Labelled[]): string[] {
  const prefixes = new Set(tickets.flatMap((t) => t.labels.flatMap((l) => splitLabel(l)?.[0] ?? [])));
  return [...prefixes].sort(compareValues);
}

export function groupTickets(
  tickets: readonly Member[],
  spec: GroupSpec,
): { groups: Map<string, string[]>; ungrouped: string[] } {
  const found = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const t of tickets) {
    const value = groupValue(t, spec);
    if (value === null) ungrouped.push(t.id);
    else found.set(value, [...(found.get(value) ?? []), t.id]);
  }
  const groups = new Map([...found.entries()].sort(([a], [b]) => compareValues(a, b)));
  return { groups, ungrouped };
}

function groupNode(id: string, members: readonly WaveTicket[]): WaveTicket {
  const open = members.find((m) => m.statusId !== "done");
  return {
    id,
    key: null,
    statusId: open?.statusId ?? "done",
    startable: members.some((m) => m.startable),
    live: members.some((m) => m.live),
    labels: [],
  };
}

function remapEdges(edges: readonly GraphEdge[], nodeOf: ReadonlyMap<string, string>): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const e of edges) {
    const from = nodeOf.get(e.from) ?? e.from;
    const to = nodeOf.get(e.to) ?? e.to;
    const id = `${e.type}|${from}|${to}`;
    if (from === to || seen.has(id)) continue;
    seen.add(id);
    out.push({ from, to, type: e.type });
  }
  return out;
}

export function collapseGroups(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  spec: GroupSpec,
): { tickets: WaveTicket[]; edges: GraphEdge[]; nodeLabels: Map<string, string> } {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const nodeOf = new Map<string, string>();
  const nodeLabels = new Map<string, string>();
  const nodes = new Map<string, WaveTicket>();
  for (const [value, ids] of groupTickets(tickets, spec).groups) {
    if (!spec.collapsed.has(value)) continue;
    const id = groupNodeId(spec.prefix, value);
    const members = ids.flatMap((m) => byId.get(m) ?? []);
    for (const m of ids) nodeOf.set(m, id);
    nodes.set(id, groupNode(id, members));
    nodeLabels.set(id, nodeLabel(spec, value, members.length));
  }
  if (nodeOf.size === 0) return { tickets: [...tickets], edges: [...edges], nodeLabels };
  const placed = new Set<string>();
  const out: WaveTicket[] = [];
  for (const t of tickets) {
    const id = nodeOf.get(t.id);
    const node = id === undefined ? t : nodes.get(id);
    if (node === undefined || placed.has(node.id)) continue;
    placed.add(node.id);
    out.push(node);
  }
  return { tickets: out, edges: remapEdges(edges, nodeOf), nodeLabels };
}
