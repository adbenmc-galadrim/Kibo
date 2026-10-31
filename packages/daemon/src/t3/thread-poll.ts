import {
  isActiveT3Status,
  KiboError,
  type ProjectEventSink,
  type T3Thread,
  T3ThreadLink,
} from "@kibo/schema";
import { z } from "zod";
import type { SessionTicket } from "../activity/session-events";
import { isKnownT3Status, mapT3Status } from "./status-map";
import type { T3Runner } from "./t3-cli";
import { threadEvent } from "./thread-events";
import { type ProjectThread, publicThread, type ThreadStore } from "./thread-store";

export const T3_POLL_MS = 30_000;
const STALE_MS = 24 * 3_600_000;

const ListedThreads = z.array(
  z.object({
    threadId: z.string(),
    status: z.string(),
    link: T3ThreadLink,
    title: z.string().optional(),
    updatedAt: z.union([z.string(), z.number()]).optional(),
  }),
);
type ListedThread = z.infer<typeof ListedThreads>[number];

type Timers<H> = { set(fn: () => void, ms: number): H; clear(handle: H): void };

type ThreadPollDeps<H> = {
  store: ThreadStore;
  run: T3Runner;
  folderOf(projectId: string): string | null;
  tickets(projectId: string): readonly SessionTicket[];
  now(): number;
  emit(projectId: string): void;
  sink?: ProjectEventSink;
  log(what: string, e: unknown): void;
  timers: Timers<H>;
};

export type ThreadPoll = {
  start(): void;
  watch(projectId: string): void;
  refresh(projectId: string): Promise<T3Thread[]>;
  settled(): Promise<void>;
  stop(): void;
};

export function parseThreadList(stdout: string): ListedThread[] {
  try {
    return ListedThreads.parse(JSON.parse(stdout));
  } catch (e) {
    throw new KiboError("T3_UNAVAILABLE", `unreadable t3 thread list: ${String(e).slice(0, 200)}`);
  }
}

export function createThreadPoll<H>(deps: ThreadPollDeps<H>): ThreadPoll {
  const { store } = deps;
  const watched = new Map<string, H>();
  const inFlight = new Map<string, Promise<T3Thread[]>>();
  const unknownLogged = new Set<string>();

  const logUnknown = (raw: string) => {
    if (isKnownT3Status(raw) || unknownLogged.has(raw)) return;
    unknownLogged.add(raw);
    deps.log(`mapping the unknown T3 status ${raw}`, new KiboError("T3_UNAVAILABLE", raw));
  };

  const unwatch = (projectId: string) => {
    const handle = watched.get(projectId);
    if (handle === undefined) return;
    deps.timers.clear(handle);
    watched.delete(projectId);
  };

  const finish = (projectId: string, thread: ProjectThread, status: string) =>
    deps.sink?.record(
      projectId,
      threadEvent(
        { kind: "t3_finished", source: "kibo", ticketId: thread.ticketId, threadId: thread.threadId, status },
        deps.tickets(projectId),
      ),
    );

  const check = async (projectId: string): Promise<T3Thread[]> => {
    const active = store.activeThreads(projectId);
    if (active.length === 0) return [];
    const folder = deps.folderOf(projectId);
    if (folder === null) throw new KiboError("PROJECT_FOLDER_MISSING", `project ${projectId} has no folder`);
    const { stdout } = await deps.run(["thread", "list", "--project", folder, "--json"], {});
    const listed = new Map(parseThreadList(stdout).map((t) => [t.threadId, t]));
    const checkedAt = deps.now();
    let changed = false;
    const checked = active.map((row) => {
      const thread = publicThread(row);
      const found = listed.get(thread.threadId);
      if (found) logUnknown(found.status);
      const mapped = found ? mapT3Status(found.status) : "done";
      const remoteUpdatedAt = found?.updatedAt === undefined ? undefined : String(found.updatedAt);
      const moved =
        mapped !== thread.status || (remoteUpdatedAt ?? row.remoteUpdatedAt) !== row.remoteUpdatedAt;
      const stale = !moved && checkedAt - row.changedAt >= STALE_MS;
      const status = stale ? "done" : mapped;
      store.update(thread.threadId, {
        status,
        checkedAt,
        ...(found?.link && { link: found.link }),
        ...(remoteUpdatedAt !== undefined && { remoteUpdatedAt }),
        ...(moved && { changedAt: checkedAt }),
      });
      if (status !== thread.status) changed = true;
      if (!isActiveT3Status(status)) finish(projectId, row, status);
      return { ...thread, status, checkedAt, link: found?.link || thread.link };
    });
    if (changed) deps.emit(projectId);
    if (store.activeThreads(projectId).length === 0) unwatch(projectId);
    return checked;
  };

  const refresh = (projectId: string): Promise<T3Thread[]> => {
    const running = inFlight.get(projectId);
    if (running) return running;
    const work = check(projectId).finally(() => inFlight.delete(projectId));
    inFlight.set(projectId, work);
    return work;
  };

  const tick = (projectId: string) => {
    refresh(projectId).catch((e: unknown) => {
      if (e instanceof KiboError && e.code === "NOT_FOUND") unwatch(projectId);
      deps.log(`polling the T3 threads of ${projectId}`, e);
    });
  };

  const watch = (projectId: string) => {
    if (watched.has(projectId)) return;
    watched.set(
      projectId,
      deps.timers.set(() => tick(projectId), T3_POLL_MS),
    );
  };

  return {
    start() {
      for (const projectId of store.activeProjects()) watch(projectId);
    },
    watch,
    refresh,
    async settled() {
      await Promise.allSettled(inFlight.values());
    },
    stop() {
      for (const projectId of [...watched.keys()]) unwatch(projectId);
    },
  };
}
