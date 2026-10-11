import type { StatusId } from "@kibo/schema";
import { blocksDag, compareKeys } from "./blocks-dag";
import type { GraphEdge, GraphTicket } from "./critical-path";
import { GAP_X, GAP_Y, type GraphLayout, NODE_H, NODE_W, type NodePosition } from "./layout";

export type WaveTicket = GraphTicket & { startable: boolean; live: boolean; labels: readonly string[] };
export type WaveLayout = GraphLayout & { columns: number };

export const WAVE_COLUMN_DONE = 0;
const FIRST_WAVE = 1;
const ACTIVE_STATUSES: ReadonlySet<StatusId> = new Set(["in_progress", "in_review", "blocked"]);

const byKey = (tickets: readonly WaveTicket[]): WaveTicket[] =>
  [...tickets].sort((a, b) => compareKeys(a.key, b.key) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const opensFirstWave = (t: WaveTicket): boolean => t.startable || t.live || ACTIVE_STATUSES.has(t.statusId);

function assignColumns(tickets: readonly WaveTicket[], edges: readonly GraphEdge[]): Map<string, number> {
  const open = byKey(tickets.filter((t) => t.statusId !== "done"));
  const byId = new Map(open.map((t) => [t.id, t]));
  const { order, pred } = blocksDag(open, [...edges]);
  const column = new Map<string, number>();
  for (const t of tickets) if (t.statusId === "done") column.set(t.id, WAVE_COLUMN_DONE);
  for (const id of order) {
    const t = byId.get(id);
    const blockers = pred.get(id) ?? [];
    const forced = t === undefined || opensFirstWave(t) || blockers.length === 0;
    column.set(id, forced ? FIRST_WAVE : 1 + Math.max(...blockers.map((b) => column.get(b) ?? FIRST_WAVE)));
  }
  return column;
}

function blockersOf(edges: readonly GraphEdge[], shown: ReadonlySet<string>): Map<string, string[]> {
  const blockers = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "blocks" || e.from === e.to || !shown.has(e.from) || !shown.has(e.to)) continue;
    blockers.set(e.to, [...(blockers.get(e.to) ?? []), e.from]);
  }
  return blockers;
}

function orderColumns(
  sorted: readonly WaveTicket[],
  column: ReadonlyMap<string, number>,
  blockers: ReadonlyMap<string, string[]>,
): { column: number; ids: string[] }[] {
  const keyRank = new Map(sorted.map((t, i) => [t.id, i]));
  const byColumn = new Map<number, string[]>();
  for (const t of sorted) {
    const c = column.get(t.id) ?? FIRST_WAVE;
    byColumn.set(c, [...(byColumn.get(c) ?? []), t.id]);
  }
  const rank = new Map<string, number>();
  const result: { column: number; ids: string[] }[] = [];
  for (const c of [...byColumn.keys()].sort((a, b) => a - b)) {
    const ids = byColumn.get(c) ?? [];
    const bary = new Map(
      ids.map((id) => {
        const ranks = (blockers.get(id) ?? []).flatMap((b) => {
          const r = rank.get(b);
          return r === undefined ? [] : [r];
        });
        return [id, ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : Infinity];
      }),
    );
    const barycenter = (id: string) => bary.get(id) ?? Infinity;
    ids.sort(
      (a, b) =>
        (barycenter(a) === barycenter(b) ? 0 : barycenter(a) < barycenter(b) ? -1 : 1) ||
        (keyRank.get(a) ?? 0) - (keyRank.get(b) ?? 0),
    );
    for (const [i, id] of ids.entries()) rank.set(id, i);
    result.push({ column: c, ids });
  }
  return result;
}

export function layoutWaves(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  opts: { showDone: boolean },
): WaveLayout {
  const shown = byKey(tickets.filter((t) => opts.showDone || t.statusId !== "done"));
  const column = assignColumns(shown, edges);
  const ids = new Set(shown.map((t) => t.id));
  const columns = orderColumns(shown, column, blockersOf(edges, ids));
  const first = columns[0]?.column ?? FIRST_WAVE;
  const nodes: NodePosition[] = columns.flatMap(({ column: layer, ids }) =>
    ids.map((id, order) => ({
      id,
      layer,
      order,
      x: (layer - first) * (NODE_W + GAP_X),
      y: order * (NODE_H + GAP_Y),
      isolated: false,
    })),
  );
  nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  const span = columns.length === 0 ? 0 : (columns[columns.length - 1]?.column ?? first) - first + 1;
  const rows = Math.max(0, ...columns.map((c) => c.ids.length));
  return {
    nodes,
    width: span === 0 ? 0 : span * (NODE_W + GAP_X) - GAP_X,
    height: rows === 0 ? 0 : rows * (NODE_H + GAP_Y) - GAP_Y,
    isolatedTop: null,
    columns: span,
  };
}
