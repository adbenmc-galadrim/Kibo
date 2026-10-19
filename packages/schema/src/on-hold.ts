import type { Link } from "./link";
import { type Ticket, ticketKeyLabel } from "./ticket";

export type OnHold = { source: "own" | "dependency"; key: string; reason: string; since: string };
export type HoldSource = Pick<Ticket, "id" | "key" | "statusId" | "hold" | "parentId">;
type HoldLink = Pick<Link, "from" | "to" | "type">;

export const HOLD_SUGGESTIONS_MAX = 6;
export const SHORT_REASON_MAX = 24;

const byKey = (a: string, b: string): number => a.localeCompare(b, "en", { numeric: true });

const canWait = (t: HoldSource): boolean => t.parentId !== null && t.statusId !== "done";

function downstreamOf(links: readonly HoldLink[]): Map<string, string[]> {
  const next = new Map<string, string[]>();
  for (const l of links) {
    if (l.type === "blocks" && l.from !== l.to) next.set(l.from, [...(next.get(l.from) ?? []), l.to]);
  }
  return next;
}

function ownHolds(tickets: readonly HoldSource[], projectKey: string): Map<string, OnHold> {
  const own = tickets
    .filter(canWait)
    .flatMap((t) =>
      t.hold === null
        ? []
        : [{ id: t.id, hold: { source: "own" as const, key: ticketKeyLabel(t, projectKey), ...t.hold } }],
    )
    .sort((a, b) => byKey(a.hold.key, b.hold.key));
  return new Map(own.map((o) => [o.id, o.hold]));
}

export function holdsOf(
  tickets: readonly HoldSource[],
  links: readonly HoldLink[],
  projectKey: string,
): Map<string, OnHold> {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const holds = ownHolds(tickets, projectKey);
  const next = downstreamOf(links);
  const waits = (id: string): boolean => {
    const target = byId.get(id);
    return target !== undefined && canWait(target);
  };
  for (const [sourceId, source] of [...holds]) {
    const queue = [sourceId];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length; i += 1) {
      for (const to of next.get(queue[i] ?? "") ?? []) {
        if (seen.has(to) || !waits(to)) continue;
        seen.add(to);
        queue.push(to);
        if (!holds.has(to)) holds.set(to, { ...source, source: "dependency" });
      }
    }
  }
  return holds;
}

export const isHeld = (t: { onHold: OnHold | null }): boolean => t.onHold !== null;

function byFrequency(reasons: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts].sort(([a, n], [b, m]) => m - n || a.localeCompare(b, "fr")).map(([r]) => r);
}

export function holdSuggestions(
  current: readonly (string | null)[],
  journal: readonly string[],
  max = HOLD_SUGGESTIONS_MAX,
): string[] {
  const now = byFrequency(current.filter((r): r is string => r !== null));
  return [...new Set([...now, ...journal])].slice(0, max);
}

export type HeldGroup<T> = { reason: string; steps: T[]; dependents: number };

export function heldByReason<T extends { onHold: OnHold | null }>(tickets: readonly T[]): HeldGroup<T>[] {
  const groups = new Map<string, { since: string; steps: T[] }>();
  for (const t of tickets) {
    if (t.onHold?.source !== "own") continue;
    const group = groups.get(t.onHold.reason) ?? { since: t.onHold.since, steps: [] };
    group.steps.push(t);
    if (t.onHold.since < group.since) group.since = t.onHold.since;
    groups.set(t.onHold.reason, group);
  }
  const keyOf = (t: T): string => t.onHold?.key ?? "";
  const dependentsOf = (keys: ReadonlySet<string>): number =>
    tickets.filter((t) => t.onHold?.source === "dependency" && keys.has(t.onHold.key)).length;
  return [...groups]
    .sort(([a, g], [b, h]) => g.since.localeCompare(h.since) || a.localeCompare(b, "fr"))
    .map(([reason, g]) => {
      const steps = [...g.steps].sort((a, b) => byKey(keyOf(a), keyOf(b)));
      return { reason, steps, dependents: dependentsOf(new Set(steps.map(keyOf))) };
    });
}

export function shortReason(reason: string, max = SHORT_REASON_MAX): string {
  const points = Array.from(reason);
  return points.length <= max ? reason : `${points.slice(0, max).join("").trimEnd()}…`;
}
