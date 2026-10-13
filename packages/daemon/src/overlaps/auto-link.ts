import { autoLinkRule, type ImportProbe, type LinkProposal, wouldCreateCycle } from "@kibo/core";
import {
  type Actor,
  type AutoLink,
  FINAL_STATUSES,
  KiboError,
  Link,
  type MomentData,
  type ProjectCommand,
  type ProjectSnapshot,
  type RunView,
  type WorkspaceIndex,
  type WorkspaceRun,
} from "@kibo/schema";
import { type CommandMeta, KIBO_COMMAND, USER_COMMAND } from "../docs";
import type { OverlapStore } from "./store";

export type AutoLinkerDeps = {
  store: OverlapStore;
  docs: { run(projectId: string, command: ProjectCommand, meta: CommandMeta): unknown };
  snapshot(projectId: string): ProjectSnapshot;
  run(runId: string): RunView | null;
  probes(index: WorkspaceIndex): ImportProbe;
  moment(runId: string, data: MomentData): void;
  now(): number;
};

export type AutoLinker = {
  evaluate(projectId: string, indexes: WorkspaceIndex[], runs: WorkspaceRun[]): Promise<void>;
  cancel(id: string, by: Actor): AutoLink;
  reconcileRemoved(projectId: string): void;
};

type Ends = { from: RunView & { ticketId: string }; to: RunView & { ticketId: string } };

const ticketRunOf = (run: RunView | null, projectId: string): (RunView & { ticketId: string }) | null =>
  run !== null && run.kind === "ticket" && run.projectId === projectId && run.ticketId !== null
    ? { ...run, ticketId: run.ticketId }
    : null;

const blocks = (snapshot: ProjectSnapshot, from: string, to: string): Link | undefined =>
  snapshot.links.find((l) => l.type === "blocks" && l.from === from && l.to === to);

const isCycle = (e: unknown): boolean => e instanceof KiboError && e.code === "LINK_CYCLE";

export function createAutoLinker(deps: AutoLinkerDeps): AutoLinker {
  const reportedCycles = new Set<string>();

  const endsOf = (projectId: string, p: LinkProposal): Ends | null => {
    const from = ticketRunOf(deps.run(p.from.runId), projectId);
    const to = ticketRunOf(deps.run(p.to.runId), projectId);
    if (from === null || to === null || from.ticketId === to.ticketId) return null;
    return { from, to };
  };

  const eligible = (projectId: string, snapshot: ProjectSnapshot, { from, to }: Ends): boolean => {
    const blocker = snapshot.tickets.find((t) => t.id === from.ticketId);
    if (!blocker || !snapshot.tickets.some((t) => t.id === to.ticketId)) return false;
    if (FINAL_STATUSES.includes(blocker.statusId)) return false;
    if (deps.store.autoLink.cancelled(projectId, from.ticketId, to.ticketId)) return false;
    const known = deps.store.autoLink
      .list(projectId)
      .some((l) => l.fromTicketId === from.ticketId && l.toTicketId === to.ticketId);
    return !known && blocks(snapshot, from.ticketId, to.ticketId) === undefined;
  };

  const keyOf = (snapshot: ProjectSnapshot, ticketId: string): string =>
    snapshot.tickets.find((t) => t.id === ticketId)?.key ?? ticketId;

  const momentOf = (
    snapshot: ProjectSnapshot,
    ends: Ends,
    p: LinkProposal,
    autoLinkId: string | null,
  ): MomentData => ({
    kind: "auto_link",
    autoLinkId,
    fromTicketKey: keyOf(snapshot, ends.from.ticketId),
    toTicketKey: keyOf(snapshot, ends.to.ticketId),
    reason: p.reason,
    path: p.path,
    name: p.name,
    failure: autoLinkId === null ? "cycle" : null,
  });

  const tell = (ends: Ends, data: MomentData) => {
    deps.moment(ends.from.id, data);
    deps.moment(ends.to.id, data);
  };

  const addLink = (projectId: string, snapshot: ProjectSnapshot, ends: Ends): string | null => {
    const command = {
      method: "addLink",
      from: ends.from.ticketId,
      to: ends.to.ticketId,
      type: "blocks",
    } as const;
    if (wouldCreateCycle(snapshot.links, command.from, command.to)) return null;
    let result: unknown;
    try {
      result = deps.docs.run(projectId, command, KIBO_COMMAND);
    } catch (e) {
      if (isCycle(e)) return null;
      throw e;
    }
    const parsed = Link.safeParse(result);
    const id = parsed.success
      ? parsed.data.id
      : blocks(deps.snapshot(projectId), command.from, command.to)?.id;
    if (id === undefined) throw new KiboError("INTERNAL", `link ${command.from} → ${command.to} not found`);
    return id;
  };

  const reportCycle = (projectId: string, snapshot: ProjectSnapshot, ends: Ends, p: LinkProposal): void => {
    const pair = `${projectId}\u0000${ends.from.ticketId}\u0000${ends.to.ticketId}`;
    if (!reportedCycles.has(pair)) tell(ends, momentOf(snapshot, ends, p, null));
    reportedCycles.add(pair);
  };

  const link = (projectId: string, p: LinkProposal): void => {
    const ends = endsOf(projectId, p);
    const snapshot = deps.snapshot(projectId);
    if (ends === null || !eligible(projectId, snapshot, ends)) return;
    const linkId = addLink(projectId, snapshot, ends);
    if (linkId === null) {
      reportCycle(projectId, snapshot, ends, p);
      return;
    }
    const row = deps.store.autoLink.create({
      projectId,
      linkId,
      fromTicketId: ends.from.ticketId,
      toTicketId: ends.to.ticketId,
      fromTicketKey: keyOf(snapshot, ends.from.ticketId),
      toTicketKey: keyOf(snapshot, ends.to.ticketId),
      ownerRunId: ends.from.id,
      otherRunId: ends.to.id,
      reason: p.reason,
      detail: { path: p.path, name: p.name },
      at: deps.now(),
    });
    tell(ends, momentOf(snapshot, ends, p, row.id));
  };

  const reconcileRemoved = (projectId: string): void => {
    const present = new Set(deps.snapshot(projectId).links.map((l) => l.id));
    for (const row of deps.store.autoLink.list(projectId)) {
      if (row.status === "added" && !present.has(row.linkId)) {
        deps.store.autoLink.event(row.id, { type: "removed", by: null, at: deps.now() });
      }
    }
  };

  return {
    async evaluate(projectId, all, runs) {
      reconcileRemoved(projectId);
      const indexes = all.filter((index) => !index.partial);
      const resolved = deps.store.list({ projectId, state: "resolved" });
      const probes = new Map(indexes.map((index) => [index.key, deps.probes(index)]));
      const probeOf = (index: WorkspaceIndex): ImportProbe => probes.get(index.key) ?? (() => null);
      for (const a of indexes) {
        for (const b of indexes) {
          const runA = runs.find((r) => r.key === a.key);
          const runB = runs.find((r) => r.key === b.key);
          if (a.key === b.key || !runA || !runB) continue;
          const proposals = autoLinkRule(a, b, { a: probeOf(a), b: probeOf(b) }, resolved, {
            a: runA,
            b: runB,
          });
          for (const p of proposals) link(projectId, p);
        }
      }
    },
    cancel(id, by) {
      const row = deps.store.autoLink.get(id);
      if (!row) throw new KiboError("NOT_FOUND", `auto link ${id} not found`);
      if (row.status !== "added") return row;
      const present = deps.snapshot(row.projectId).links.some((l) => l.id === row.linkId);
      if (!present) return deps.store.autoLink.event(id, { type: "removed", by: null, at: deps.now() });
      deps.docs.run(row.projectId, { method: "removeLink", linkId: row.linkId }, USER_COMMAND);
      return deps.store.autoLink.event(id, { type: "cancelled", by, at: deps.now() });
    },
    reconcileRemoved,
  };
}
