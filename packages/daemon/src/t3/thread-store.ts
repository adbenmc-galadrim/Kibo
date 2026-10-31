import type { Database } from "bun:sqlite";
import { KiboError, type T3Thread, type T3ThreadStatus } from "@kibo/schema";

export type ProjectThread = T3Thread & { projectId: string; ticketId: string };
type ThreadPatch = { status: T3ThreadStatus; checkedAt: number; link?: string };

export type ThreadStore = {
  add(projectId: string, ticketId: string, thread: T3Thread): void;
  update(threadId: string, patch: ThreadPatch): void;
  threadOf(projectId: string, ticketId: string): T3Thread | null;
  latest(projectId: string): Map<string, T3Thread>;
  all(projectId: string): ProjectThread[];
  activeThreads(projectId: string): ProjectThread[];
  activeProjects(): string[];
};

type DbRow = {
  project_id: string;
  ticket_id: string;
  thread_id: string;
  link: string;
  title: string;
  status: T3ThreadStatus;
  started_at: number;
  checked_at: number;
};

const ACTIVE = "status IN ('running', 'waiting')";
const ACTIVE_LAST = `ORDER BY ${ACTIVE}, started_at, rowid`;

const toThread = (r: DbRow): ProjectThread => ({
  projectId: r.project_id,
  ticketId: r.ticket_id,
  threadId: r.thread_id,
  link: r.link,
  title: r.title,
  status: r.status,
  startedAt: r.started_at,
  checkedAt: r.checked_at,
});

export const publicThread = ({ projectId: _p, ticketId: _t, ...thread }: ProjectThread): T3Thread => thread;

export function createThreadStore(db: Database): ThreadStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS ticket_threads (project_id TEXT NOT NULL, ticket_id TEXT NOT NULL, " +
      "thread_id TEXT PRIMARY KEY, link TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, " +
      "started_at INTEGER NOT NULL, checked_at INTEGER NOT NULL)",
  );
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS ticket_threads_active ON ticket_threads (project_id, ticket_id) " +
      `WHERE ${ACTIVE}`,
  );
  const ofProject = db.query<DbRow, { projectId: string }>(
    `SELECT * FROM ticket_threads WHERE project_id = $projectId ${ACTIVE_LAST}`,
  );
  const active = db.query<DbRow, { projectId: string }>(
    `SELECT * FROM ticket_threads WHERE project_id = $projectId AND ${ACTIVE}`,
  );
  const projects = db.query<{ project_id: string }, []>(
    `SELECT DISTINCT project_id FROM ticket_threads WHERE ${ACTIVE}`,
  );
  const insert = db.query<never, DbRow>(
    "INSERT INTO ticket_threads (project_id, ticket_id, thread_id, link, title, status, started_at, checked_at) " +
      "VALUES ($project_id, $ticket_id, $thread_id, $link, $title, $status, $started_at, $checked_at)",
  );
  const patch = db.query<never, { threadId: string; status: string; checkedAt: number; link: string | null }>(
    "UPDATE ticket_threads SET status = $status, checked_at = $checkedAt, link = COALESCE($link, link) " +
      "WHERE thread_id = $threadId",
  );
  const activeThreads = (projectId: string) => active.all({ projectId }).map(toThread);
  const latest = (projectId: string) =>
    new Map(ofProject.all({ projectId }).map((r) => [r.ticket_id, publicThread(toThread(r))]));

  return {
    add(projectId, ticketId, thread) {
      if (activeThreads(projectId).some((t) => t.ticketId === ticketId)) {
        throw new KiboError("T3_THREAD_ACTIVE", `ticket ${ticketId} already has an active thread`);
      }
      insert.run({
        project_id: projectId,
        ticket_id: ticketId,
        thread_id: thread.threadId,
        link: thread.link,
        title: thread.title,
        status: thread.status,
        started_at: thread.startedAt,
        checked_at: thread.checkedAt,
      });
    },
    update(threadId, { status, checkedAt, link }) {
      patch.run({ threadId, status, checkedAt, link: link ?? null });
    },
    threadOf: (projectId, ticketId) => latest(projectId).get(ticketId) ?? null,
    latest,
    all: (projectId) => ofProject.all({ projectId }).map(toThread),
    activeThreads,
    activeProjects: () => projects.all().map((r) => r.project_id),
  };
}
