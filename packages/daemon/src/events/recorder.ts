import {
  KiboError,
  type ProjectCommand,
  ProjectEventInput,
  type ProjectEventSink,
  type ProjectSnapshot,
} from "@kibo/schema";
import type { CommandEvent } from "../docs";
import type { EventStore } from "./store";
import { deliveredRoots, markDelivered, TRACKED_METHODS, translate } from "./translate";

export type EventRecorderDeps = {
  store: EventStore;
  snapshot(projectId: string): ProjectSnapshot;
  emit(projectId: string): void;
  log(what: string, e: unknown): void;
};
export type EventRecorder = ProjectEventSink & {
  beforeCommand(projectId: string, token: unknown, method: ProjectCommand["method"]): void;
  afterCommands(projectId: string, done: readonly CommandEvent[]): void;
};

type Pending = { token: unknown; snapshot: ProjectSnapshot | null };
type Held = { events: ProjectEventInput[]; merged: ReadonlySet<string>; before: ProjectSnapshot };

const isRuleOfMerge = (held: Held, done: readonly CommandEvent[]): boolean => {
  const first = done[0]?.command;
  return (
    first?.method === "setStatus" &&
    held.merged.has(first.ticketId) &&
    done.every((e) => e.command.method === "setStatus")
  );
};

const droppedByMerge = (held: Held, event: ProjectEventInput): boolean =>
  event.kind === "status_changed" && event.ticketId !== null && held.merged.has(event.ticketId);

export function createEventRecorder(deps: EventRecorderDeps): EventRecorder {
  const pending = new Map<string, Pending>();
  const held = new Map<string, Held>();

  const write = (projectId: string, events: readonly ProjectEventInput[]) => {
    for (const event of events) deps.store.append(projectId, event);
  };
  const release = (projectId: string): boolean => {
    const waiting = held.get(projectId);
    if (!waiting) return false;
    held.delete(projectId);
    write(projectId, waiting.events);
    return true;
  };
  const hold = (projectId: string, waiting: Held) => {
    held.set(projectId, waiting);
    queueMicrotask(() => {
      try {
        if (held.get(projectId) === waiting && release(projectId)) deps.emit(projectId);
      } catch (e) {
        deps.log(`held project events not recorded for ${projectId}`, e);
      }
    });
  };

  return {
    beforeCommand(projectId, token, method) {
      const known = pending.get(projectId);
      if (
        known !== undefined &&
        known.token === token &&
        (known.snapshot !== null || !TRACKED_METHODS.has(method))
      )
        return;
      pending.set(projectId, {
        token,
        snapshot: TRACKED_METHODS.has(method) ? deps.snapshot(projectId) : null,
      });
    },
    afterCommands(projectId, done) {
      const known = pending.get(projectId);
      pending.delete(projectId);
      if (!done.some((e) => TRACKED_METHODS.has(e.command.method))) return;
      const after = deps.snapshot(projectId);
      const before = known?.snapshot ?? after;
      const events = translate({ before, after }, done);
      const waiting = held.get(projectId);
      if (waiting && isRuleOfMerge(waiting, done)) {
        held.delete(projectId);
        const all = [...waiting.events, ...events.filter((e) => !droppedByMerge(waiting, e))];
        markDelivered(all, deliveredRoots({ before: waiting.before, after }));
        write(projectId, all);
        return;
      }
      release(projectId);
      markDelivered(events, deliveredRoots({ before, after }));
      const merged = new Set(
        events.flatMap((e) => (e.kind === "pr_merged" && e.ticketId ? [e.ticketId] : [])),
      );
      if (merged.size > 0) hold(projectId, { events, merged, before });
      else write(projectId, events);
    },
    record(projectId, input) {
      const parsed = ProjectEventInput.safeParse(input);
      if (!parsed.success) throw new KiboError("INVALID_INPUT", `project event: ${parsed.error.message}`);
      release(projectId);
      deps.store.append(projectId, parsed.data);
      deps.emit(projectId);
    },
  };
}
