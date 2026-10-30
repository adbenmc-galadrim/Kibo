import type { ListProjectEventsInput, ProjectEventPage, ProjectEventSink, TicketSession } from "@kibo/schema";
import { startTicketSessions } from "./activity/bootstrap";
import type { Clock } from "./clock";
import type { PollPass } from "./code/pr-poller";
import type { Closer } from "./daemon-shutdown";
import { startProjectEvents } from "./events/bootstrap";
import { migrateTracking } from "./migrations/tracking";
import { createProjectSettings } from "./notes/settings";
import type { ActivitySources } from "./project-activity";
import type { RpcExtension } from "./rpc-extensions";
import type { Service } from "./service";
import { appSettingsRpc } from "./settings/app-settings-rpc";
import { createAppSettingsStore } from "./settings/app-settings-store";
import type { Store } from "./store";
import { type SprintEndDeps, startSprintEndWatch } from "./tracking/sprint-end";
import { createSprintEndStore } from "./tracking/sprint-end-store";

export type DaemonTracking = {
  rpc: RpcExtension[];
  sink: ProjectEventSink;
  projectEvents(input: ListProjectEventsInput): ProjectEventPage;
  passes(agent: SprintEndDeps["agent"]): PollPass[];
};

export type LateActivity = Required<ActivitySources> & { bind(sources: Required<ActivitySources>): void };

export type DaemonTrackingInput = { store: Store; service: Service; clock: Clock; activity: LateActivity };

const NO_SESSIONS: ReadonlyMap<string, TicketSession> = new Map();
const NO_EVENTS: ReadonlyMap<string, number> = new Map();
const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what} failed`, e);

export function lateActivity(): LateActivity {
  let bound: Required<ActivitySources> | null = null;
  return {
    sessions: (projectId) => bound?.sessions(projectId) ?? NO_SESSIONS,
    lastEventAt: (projectId) => bound?.lastEventAt(projectId) ?? NO_EVENTS,
    bind(sources) {
      bound = sources;
    },
  };
}

export function startDaemonTracking(input: DaemonTrackingInput, closers: Closer[]): DaemonTracking {
  const { store, service, clock } = input;
  const settings = createProjectSettings(store.db);
  migrateTracking({ docs: service.docs, settings, log: console.error, now: clock.now });
  const appSettings = createAppSettingsStore(store.db, clock.now);
  const events = startProjectEvents({ store, service, now: Date.now });
  closers.push(() => events.stop());
  const emit: Service["docs"]["emit"] = (message) => service.docs.emit(message);
  const sessions = startTicketSessions({
    db: store.db,
    service,
    clock: { now: Date.now },
    sink: events.sink,
    emit,
  });
  input.activity.bind({ sessions: sessions.activity, lastEventAt: (id) => events.store.lastEventAt(id) });
  sessions.pass();
  const sprintEnds = createSprintEndStore(store.db, Date.now);
  return {
    rpc: [appSettingsRpc({ store: appSettings, emit }), events.rpc, sessions.rpc],
    sink: events.sink,
    projectEvents: (req) => events.store.list(req),
    passes(agent) {
      const watch = startSprintEndWatch({
        docs: service.docs,
        store: sprintEnds,
        agent,
        today: clock.today,
        log,
      });
      watch.markOld();
      return [async () => sessions.pass(), async () => watch.pass()];
    },
  };
}
