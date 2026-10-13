import type { Overlap } from "@kibo/schema";
import type { Finding } from "./roles";

export type ReconcileScope = { kind: "sweep" } | { kind: "file"; workspace: string; path: string };

export type Reconciliation = { create: Finding[]; resolve: string[]; touch: string[] };

type Paired = Pick<Finding, "kind" | "key" | "ownerWorkspace" | "otherWorkspace">;

const pairOf = (p: Paired): string =>
  [p.kind, p.key, ...[p.ownerWorkspace, p.otherWorkspace].sort()].join("\u0000");

const pathOn = (o: Overlap, workspace: string): string[] => {
  const detail = o.detail;
  if (detail.kind === "file") {
    return o.ownerWorkspace === workspace || o.otherWorkspace === workspace ? [detail.path] : [];
  }
  return [
    ...(o.ownerWorkspace === workspace ? [detail.ownerPath] : []),
    ...(o.otherWorkspace === workspace ? [detail.otherPath] : []),
  ];
};

const inScope = (o: Overlap, scope: ReconcileScope): boolean =>
  scope.kind === "sweep" || pathOn(o, scope.workspace).includes(scope.path);

export function reconcile(
  open: readonly Overlap[],
  findings: readonly Finding[],
  ignored: ReadonlySet<string>,
  scope: ReconcileScope,
): Reconciliation {
  const openByPair = new Map(open.filter((o) => o.status === "open").map((o) => [pairOf(o), o]));
  const seen = new Set<string>();
  const create: Finding[] = [];
  const touch: string[] = [];
  for (const f of findings) {
    const pair = pairOf(f);
    if (ignored.has(f.key) || seen.has(pair)) continue;
    seen.add(pair);
    const existing = openByPair.get(pair);
    if (existing) touch.push(existing.id);
    else create.push(f);
  }
  const resolve = [...openByPair]
    .filter(([pair, o]) => !seen.has(pair) && inScope(o, scope))
    .map(([, o]) => o.id);
  return { create, resolve, touch };
}
