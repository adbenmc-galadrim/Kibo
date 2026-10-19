import { signalOutcomes } from "@kibo/core/signals/outcomes";
import {
  type ActionResult,
  type Actor,
  type Batch,
  foldSignal,
  isOpenSignal,
  SIGNALS_CLOSED_SHOWN,
  type Signal,
  type SignalEvent,
  type SignalKind,
  type SignalRow,
  signalRef,
  type TimedSignalEvent,
  type Wakeup,
} from "@kibo/schema";
import type { ProjectAgentSignalsPort } from "../project-agent/types";

export function signalRow(seq: number, patch: Partial<SignalRow> = {}): SignalRow {
  return {
    id: `s${seq}`,
    seq,
    projectId: "p1",
    runId: "r1",
    runLabel: "opus-dev-2",
    profileName: "opus-dev",
    originTicketId: "t1",
    originTicketKey: "SILO-1",
    ticketId: "t1",
    ticketKey: "SILO-1",
    kind: "ticket",
    title: `Signal ${seq}`,
    body: "",
    createdAt: 1_000 + seq,
    ...patch,
  };
}

type Entry = { row: SignalRow; events: TimedSignalEvent[] };

export type FakeSignals = ProjectAgentSignalsPort & {
  calls: string[];
  add(seq: number, patch?: Partial<SignalRow>, events?: SignalEvent[]): Signal;
  all(): Signal[];
  close(seq: number): void;
};

export function fakeSignals(now: () => number = () => 5_000): FakeSignals {
  const entries: Entry[] = [];
  const calls: string[] = [];
  const all = (): Signal[] => entries.map((e) => foldSignal(e.row, e.events));
  const ofProject = (projectId: string) => all().filter((s) => s.projectId === projectId);
  const open = (projectId: string) => ofProject(projectId).filter(isOpenSignal);
  const append = (ref: string, event: SignalEvent) => {
    const entry = entries.find((e) => signalRef(e.row.seq) === ref);
    if (entry) entry.events.push({ at: now(), event });
  };
  return {
    calls,
    all,
    add(seq, patch = {}, events = []) {
      const row = signalRow(seq, patch);
      entries.push({ row, events: events.map((event) => ({ at: 2_000, event })) });
      return foldSignal(row, []);
    },
    close(seq) {
      append(signalRef(seq), { type: "handled", batchId: "old", actionId: 1 });
    },
    markRead(projectId, runId) {
      calls.push(`markRead:${projectId}:${runId}`);
      for (const s of open(projectId)) if (s.status === "new") append(s.ref, { type: "read", runId });
      return open(projectId);
    },
    openRefs(projectId) {
      calls.push(`openRefs:${projectId}`);
      return open(projectId).map((s) => s.ref);
    },
    openCount: (projectId) => open(projectId).length,
    settle(batch: Batch, results: readonly ActionResult[], by: Actor) {
      calls.push(`settle:${batch.id}:${results.map((r) => `${r.actionId}=${r.outcome}`).join(",")}`);
      const outcomes = signalOutcomes(batch, results);
      for (const o of outcomes.handled)
        append(o.ref, { type: "handled", batchId: o.batchId, actionId: o.actionId });
      for (const o of outcomes.ignored)
        append(o.ref, { type: "ignored", by, batchId: o.batchId, actionId: o.actionId });
    },
    list(projectId) {
      calls.push(`list:${projectId}`);
      const signals = ofProject(projectId).sort((a, b) => b.createdAt - a.createdAt);
      const closed = signals.filter((s) => !isOpenSignal(s)).slice(0, SIGNALS_CLOSED_SHOWN);
      return {
        signals: [...signals.filter(isOpenSignal), ...closed],
        wakeup: { projectId, lastAt: null, dueAt: null },
      };
    },
  };
}

export type FakeWakeupStore = {
  wakeups: Map<string, Wakeup>;
  kinds: Map<string, SignalKind[]>;
  wakeup(projectId: string): Wakeup;
  saveWakeup(w: Wakeup): void;
  due(): Wakeup[];
  open(projectId: string): Signal[];
};

export function fakeWakeupStore(): FakeWakeupStore {
  const wakeups = new Map<string, Wakeup>();
  const kinds = new Map<string, SignalKind[]>();
  return {
    wakeups,
    kinds,
    wakeup: (projectId) => wakeups.get(projectId) ?? { projectId, lastAt: null, dueAt: null },
    saveWakeup: (w) => {
      wakeups.set(w.projectId, w);
    },
    due: () => [...wakeups.values()].filter((w) => w.dueAt !== null),
    open: (projectId) =>
      (kinds.get(projectId) ?? []).map((kind, i) => foldSignal(signalRow(i + 1, { projectId, kind }), [])),
  };
}
