import { signalOutcomes, signalReply, type WakeReply } from "@kibo/core";
import {
  type ActionResult,
  type Actor,
  type Batch,
  KiboError,
  maskSecrets,
  type ProjectSignalCount,
  type ProjectSnapshot,
  type RunView,
  SIGNALS_CLOSED_SHOWN,
  SIGNALS_PER_RUN_MAX,
  type Signal,
  type SignalEvent,
  SignalInput,
  type SignalKind,
  type SignalRef,
  type SignalsView,
  WAKE_KINDS,
} from "@kibo/schema";
import type { z } from "zod";
import type { Notice } from "../agents/notifier";
import { guarded } from "../agents/orchestrator-support";
import type { TraceService } from "../moments/trace-service";
import { clockTime } from "./messages";
import { blockerNotice } from "./notices";
import type { NewSignal, SignalStore } from "./store";

export type SignalDeps = {
  store: SignalStore;
  project(projectId: string): ProjectSnapshot | null;
  trace: Pick<TraceService, "note">;
  wake(projectId: string, kind: SignalKind): WakeReply;
  notify(notice: Notice): void;
  emit(): void;
  now?: () => number;
  formatTime?: (at: number) => string;
};
export type SignalService = {
  record(run: RunView, input: unknown): Promise<string>;
  list(projectId: string): SignalsView;
  ignore(projectId: string, signalId: string, by: Actor): Signal;
  markRead(projectId: string, runId: string): Signal[];
  openRefs(projectId: string): SignalRef[];
  openCount(projectId: string): number;
  settle(batch: Batch, results: readonly ActionResult[], by: Actor): void;
  counts(): ProjectSignalCount[];
};

type TicketRun = RunView & { projectId: string; ticketId: string };
type TicketRef = { id: string; key: string };

const issueText = (issue: z.ZodIssue): string =>
  issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;

function ticketRun(run: RunView): TicketRun {
  const { projectId, ticketId } = run;
  if (run.kind !== "ticket" || projectId === null || ticketId === null)
    throw new KiboError("FORBIDDEN", `run ${run.id} cannot signal: it is not a ticket run`);
  return { ...run, projectId, ticketId };
}

function parsed(input: unknown): SignalInput {
  const result = SignalInput.safeParse(input);
  if (!result.success) throw new KiboError("INVALID_INPUT", result.error.issues.map(issueText).join("; "));
  return result.data;
}

export function createSignalService(deps: SignalDeps): SignalService {
  const { store } = deps;
  const now = deps.now ?? Date.now;
  const formatTime = deps.formatTime ?? clockTime;

  function targets(run: TicketRun, key: string | undefined): { origin: TicketRef; target: TicketRef } {
    const snapshot = deps.project(run.projectId);
    if (snapshot === null) throw new KiboError("NOT_FOUND", `project ${run.projectId} not found`);
    const own = snapshot.tickets.find((t) => t.id === run.ticketId);
    const origin = { id: run.ticketId, key: own?.key ?? run.ticketKey ?? "" };
    if (key === undefined) return { origin, target: origin };
    const found = snapshot.tickets.find((t) => t.key === key);
    if (!found) throw new KiboError("INVALID_INPUT", `ticket: ${key} is not a ticket of this project`);
    return { origin, target: { id: found.id, key } };
  }

  function admit(run: TicketRun, input: SignalInput): void {
    if (store.countByRun(run.id) >= SIGNALS_PER_RUN_MAX)
      throw new KiboError("QUOTA_EXCEEDED", `a run sends ${SIGNALS_PER_RUN_MAX} signals at most`);
    if (store.duplicate(run.id, input.kind, input.title))
      throw new KiboError("CONFLICT", "signal already sent by this run");
  }

  function wake(signal: Signal): WakeReply {
    if (!WAKE_KINDS.includes(signal.kind)) return { kind: "none" };
    try {
      return deps.wake(signal.projectId, signal.kind);
    } catch (e) {
      console.error(`[kibo-daemon] wake-up for signal ${signal.id} failed`, e);
      return { kind: "none" };
    }
  }

  function announce(run: TicketRun, signal: Signal): WakeReply {
    guarded("signal moment", () => {
      deps.trace.note(run.id, {
        kind: "signal",
        signalId: signal.id,
        ref: signal.ref,
        signalKind: signal.kind,
        title: signal.title,
      });
    });
    const reply = wake(signal);
    if (signal.kind === "blocker")
      guarded("blocker notification", () => deps.notify(blockerNotice(run, signal)));
    deps.emit();
    return reply;
  }

  async function record(view: RunView, raw: unknown): Promise<string> {
    const run = ticketRun(view);
    const input = parsed(raw);
    const { origin, target } = targets(run, input.ticket);
    const masked = { ...input, title: maskSecrets(input.title), body: maskSecrets(input.body) };
    admit(run, masked);
    const row: NewSignal = {
      id: crypto.randomUUID(),
      projectId: run.projectId,
      runId: run.id,
      runLabel: run.label,
      profileName: run.profileName,
      originTicketId: origin.id,
      originTicketKey: origin.key,
      ticketId: target.id,
      ticketKey: target.key,
      kind: masked.kind,
      title: masked.title,
      body: masked.body,
      createdAt: now(),
    };
    const signal = store.create(row);
    return signalReply(signal, announce(run, signal), formatTime);
  }

  function ofProject(projectId: string, signalId: string): Signal {
    const signal = store.get(signalId);
    if (signal?.projectId !== projectId) throw new KiboError("NOT_FOUND", `signal ${signalId} not found`);
    return signal;
  }

  function settle(batch: Batch, results: readonly ActionResult[], by: Actor): void {
    const { handled, ignored } = signalOutcomes(batch, results);
    const at = now();
    const append = (ref: SignalRef, event: SignalEvent) => {
      const signal = store.byRef(batch.projectId, ref);
      if (signal) store.appendEvent(signal.id, event, at);
    };
    for (const o of handled) append(o.ref, { type: "handled", batchId: o.batchId, actionId: o.actionId });
    for (const o of ignored) append(o.ref, { type: "ignored", by, batchId: o.batchId, actionId: o.actionId });
    if (handled.length + ignored.length > 0) deps.emit();
  }

  return {
    record,
    list: (projectId) => ({
      signals: [...store.open(projectId).reverse(), ...store.closed(projectId, SIGNALS_CLOSED_SHOWN)],
      wakeup: store.wakeup(projectId),
    }),
    ignore(projectId, signalId, by) {
      const signal = ofProject(projectId, signalId);
      const ignored = store.appendEvent(
        signal.id,
        { type: "ignored", by, batchId: null, actionId: null },
        now(),
      );
      deps.emit();
      return ignored;
    },
    markRead(projectId, runId) {
      const at = now();
      const open = store.open(projectId);
      const fresh = open.filter((s) => s.status === "new");
      for (const s of fresh) store.appendEvent(s.id, { type: "read", runId }, at);
      if (fresh.length > 0) deps.emit();
      return fresh.length > 0 ? store.open(projectId) : open;
    },
    openRefs: (projectId) => store.open(projectId).map((s) => s.ref),
    openCount: (projectId) => store.open(projectId).length,
    settle,
    counts: () => store.counts(),
  };
}
