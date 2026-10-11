import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WakeReply } from "@kibo/core";
import type { MomentData, RunMoment, RunView, SignalKind, Ticket } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import { type Harness, harness } from "../project-agent/fakes.test-helper";
import { runView } from "../questions/questions.test-helper";
import { createSignalService, type SignalService } from "./service";
import { openSignalStore, type SignalStore } from "./store";

export const WAKE_AT = Date.UTC(2026, 9, 12, 12, 41);

export type SignalSetup = {
  h: Harness;
  store: SignalStore;
  service: SignalService;
  order: string[];
  notes: { runId: string; data: MomentData }[];
  wakes: { projectId: string; kind: SignalKind }[];
  notices: Notice[];
  emits: () => number;
  first: Ticket;
  second: Ticket;
  ticketRun(p?: Partial<RunView>): RunView;
  close(): void;
};

const fakeWake = (kind: SignalKind): WakeReply =>
  kind === "ticket" ? { kind: "now" } : { kind: "scheduled", at: WAKE_AT };

export function signalSetup(): SignalSetup {
  const h = harness();
  const home = mkdtempSync(join(tmpdir(), "kibo-signal-service-"));
  const real = openSignalStore(home);
  const order: string[] = [];
  const notes: SignalSetup["notes"] = [];
  const wakes: SignalSetup["wakes"] = [];
  const notices: Notice[] = [];
  let emitted = 0;
  const store: SignalStore = {
    ...real,
    create(row) {
      order.push("create");
      return real.create(row);
    },
  };
  const first = h.ticket("Récepteur de hooks");
  const second = h.ticket("Transitions Loro");
  const service = createSignalService({
    store,
    project: (projectId) => (projectId === h.project.id ? h.data.project(projectId) : null),
    trace: {
      note(runId, data): RunMoment {
        order.push("note");
        notes.push({ runId, data });
        return { id: notes.length, runId, seq: notes.length, at: 1, stepId: null, data };
      },
    },
    wake(projectId, kind) {
      wakes.push({ projectId, kind });
      return fakeWake(kind);
    },
    notify: (notice) => notices.push(notice),
    emit: () => {
      emitted += 1;
    },
    now: () => 1_000,
    formatTime: () => "14:41",
  });
  return {
    h,
    store,
    service,
    order,
    notes,
    wakes,
    notices,
    emits: () => emitted,
    first,
    second,
    ticketRun: (p = {}) =>
      runView({
        id: "r1",
        projectId: h.project.id,
        ticketId: first.id,
        ticketKey: first.key,
        label: "opus-dev-2",
        profileName: "opus",
        ...p,
      }),
    close() {
      real.close();
      h.close();
      rmSync(home, { recursive: true, force: true });
    },
  };
}
