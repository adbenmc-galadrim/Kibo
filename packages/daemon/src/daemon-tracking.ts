import type {
  ListProjectEventsInput,
  ProjectEventPage,
  ProjectEventSink,
  T3Thread,
  TicketSession,
} from "@kibo/schema";
import { startTicketSessions } from "./activity/bootstrap";
import type { Clock } from "./clock";
import type { PollPass } from "./code/pr-poller";
import type { Closer } from "./daemon-shutdown";
import { startProjectEvents } from "./events/bootstrap";
import { restoreLocalKeys } from "./migrations/local-keys";
import { migrateTracking } from "./migrations/tracking";
import { createProjectSettings } from "./notes/settings";
import type { ActivitySources } from "./project-activity";
import type { RpcExtension } from "./rpc-extensions";
import type { Service } from "./service";
import type { Store } from "./store";
import { type SprintEndDeps, startSprintEndWatch } from "./tracking/sprint-end";
import { createSprintEndStore } from "./tracking/sprint-end-store";

type DaemonTracking = {
  rpc: RpcExtension[];
  sink: ProjectEventSink;
  projectEvents(input: ListProjectEventsInput): ProjectEventPage;
  passes(agent: SprintEndDeps["agent"]): PollPass[];
};

type TrackingSources = Omit<Required<ActivitySources>, "threads">;
type LateActivity = Required<ActivitySources> & {
  bind(sources: TrackingSources): void;
  bindThreads(threads: Required<ActivitySources>["threads"]): void;
};

type DaemonTrackingInput = { store: Store; service: Service; clock: Clock; activity: LateActivity };

const NO_SESSIONS: ReadonlyMap<string, TicketSession> = new Map();
const NO_THREADS: ReadonlyMap<string, T3Thread> = new Map();
const NO_EVENTS: ReadonlyMap<string, number> = new Map();
const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what} failed`, e);

export function lateActivity(): LateActivity {
  let bound: TrackingSources | null = null;
  let boundThreads: Required<ActivitySources>["threads"] | null = null;
  return {
    threads: (projectId) => boundThreads?.(projectId) ?? NO_THREADS,
    bindThreads(threads) {
      boundThreads = threads;
    },
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
  const events = startProjectEvents({ store, service, now: clock.ticking });
  closers.push(() => events.stop());
  restoreLocalKeys({ docs: service.docs, settings, sink: events.sink, now: clock.now });
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
    rpc: [events.rpc, sessions.rpc],
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
