import {
  isActiveT3Status,
  KiboError,
  type ProjectEventSink,
  startReasonText,
  T3_RPC_METHODS,
  type T3Launch,
  type T3Preview,
  type T3RpcRequest,
  type T3Status,
  type T3Thread,
  type TicketView,
} from "@kibo/schema";
import { z } from "zod";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import { composeThreadStart, displayFolder, displayThreadStart } from "./compose-command";
import { type T3Runner, T3Timeout } from "./t3-cli";
import { threadEvent } from "./thread-events";
import { parseThreadList, type ThreadPoll } from "./thread-poll";
import type { ThreadStore } from "./thread-store";

const T3_STATUS_CACHE_MS = 30_000;
const T3_PROBE_ARGS = ["theme", "show"];
const STATUS_TIMEOUT_MS = 5_000;
const LAUNCH_TIMEOUT_MS = 30_000;

type LaunchTarget = { projectId: string; folder: string; argv: readonly string[]; title: string };

const Started = z.object({
  threadId: z.string().min(1),
  link: z.string().optional(),
  title: z.string().optional(),
});

type T3RpcDeps = {
  bin: string;
  home: string;
  run: T3Runner;
  store: ThreadStore;
  poll: ThreadPoll;
  project(projectId: string): { folder: string | null; tickets: readonly TicketView[] };
  now(): number;
  sink?: ProjectEventSink;
  emit(projectId: string): void;
};

export type T3Api = {
  status(): Promise<T3Status>;
  preview(projectId: string, ticketKey: string): T3Preview;
  launch(projectId: string, ticketKey: string): Promise<T3Launch>;
  threadOf(projectId: string, ticketKey: string): T3Thread | null;
  refresh(projectId: string): Promise<T3Thread[]>;
};

function ticketOf(tickets: readonly TicketView[], ticketKey: string): TicketView {
  const ticket = tickets.find((t) => t.key === ticketKey);
  if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${ticketKey} not found`);
  return ticket;
}

function requireFolder(folder: string | null, projectId: string): string {
  if (folder === null) throw new KiboError("PROJECT_FOLDER_MISSING", `project ${projectId} has no folder`);
  return folder;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type StartedThread = z.infer<typeof Started>;

function parseStarted(stdout: string): StartedThread | null {
  const parsed = safeJson(stdout);
  const started = Started.safeParse(parsed);
  return started.success ? started.data : null;
}

const listThreads = async (deps: T3RpcDeps, folder: string) =>
  parseThreadList((await deps.run(["thread", "list", "--project", folder, "--json"], {})).stdout);

async function findBack(
  deps: T3RpcDeps,
  target: LaunchTarget,
  before: ReadonlySet<string>,
): Promise<StartedThread> {
  const failed = new KiboError(
    "T3_FAILED",
    `no answer from t3 thread start, a thread may have been created in T3: ${target.title}`,
  );
  const known = new Set(deps.store.all(target.projectId).map((t) => t.threadId));
  const listed = await listThreads(deps, target.folder).catch((e: unknown) => {
    if (e instanceof KiboError) throw failed;
    throw e;
  });
  const candidates = listed.filter(
    (t) => t.title === target.title && !known.has(t.threadId) && !before.has(t.threadId),
  );
  const [found] = candidates;
  if (!found || candidates.length > 1) throw failed;
  return { threadId: found.threadId, title: target.title, ...(found.link && { link: found.link }) };
}

async function startThread(deps: T3RpcDeps, target: LaunchTarget): Promise<StartedThread> {
  const before = new Set((await listThreads(deps, target.folder)).map((t) => t.threadId));
  try {
    const { stdout } = await deps.run(target.argv.slice(1), { timeoutMs: LAUNCH_TIMEOUT_MS });
    return parseStarted(stdout) ?? (await findBack(deps, target, before));
  } catch (e) {
    if (e instanceof T3Timeout) return findBack(deps, target, before);
    if (e instanceof KiboError && e.code === "T3_UNAVAILABLE") throw new KiboError("T3_FAILED", e.detail);
    throw e;
  }
}

function createStatus(deps: Pick<T3RpcDeps, "bin" | "run" | "now">): () => Promise<T3Status> {
  let downUntil = 0;
  const down: T3Status = { available: false, reason: "server-down", bin: deps.bin };
  return async () => {
    if (deps.now() < downUntil) return down;
    try {
      await deps.run(T3_PROBE_ARGS, { timeoutMs: STATUS_TIMEOUT_MS });
      return { available: true, bin: deps.bin };
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
      if (e.code === "T3_MISSING") return { available: false, reason: "missing", bin: deps.bin };
      if (e.code !== "T3_UNAVAILABLE") throw e;
      downUntil = deps.now() + T3_STATUS_CACHE_MS;
      return down;
    }
  };
}

export function createT3Api(deps: T3RpcDeps): T3Api {
  const launching = new Set<string>();
  const compose = (projectId: string, ticketKey: string) => {
    const { folder, tickets } = deps.project(projectId);
    const ticket = ticketOf(tickets, ticketKey);
    const resolved = requireFolder(folder, projectId);
    const argv = composeThreadStart({ bin: deps.bin, folder: resolved, key: ticketKey, title: ticket.title });
    const command = displayThreadStart({ folder: resolved, key: ticketKey, home: deps.home });
    return { argv, command, folder: resolved, ticket, tickets };
  };
  const launchOnce = async (projectId: string, ticketKey: string): Promise<T3Launch> => {
    const { argv, command, folder, ticket, tickets } = compose(projectId, ticketKey);
    const current = deps.store.threadOf(projectId, ticket.id);
    if (current && isActiveT3Status(current.status)) {
      throw new KiboError("T3_THREAD_ACTIVE", `${ticketKey} already has the thread ${current.threadId}`);
    }
    const title = `${ticketKey} · ${ticket.title}`;
    const started = await startThread(deps, { projectId, folder, argv, title });
    const now = deps.now();
    const thread: T3Thread = {
      threadId: started.threadId,
      link: started.link ?? "",
      title: started.title ?? title,
      status: "running",
      startedAt: now,
      checkedAt: now,
    };
    deps.store.add(projectId, ticket.id, thread);
    deps.sink?.record(
      projectId,
      threadEvent(
        {
          kind: "t3_started",
          source: "user",
          ticketId: ticket.id,
          threadId: thread.threadId,
          status: "running",
        },
        tickets,
      ),
    );
    deps.poll.watch(projectId);
    deps.emit(projectId);
    return { thread, command };
  };
  return {
    status: createStatus(deps),
    preview(projectId, ticketKey) {
      const { argv, command, folder, ticket } = compose(projectId, ticketKey);
      const warning = ticket.startReason === null ? null : startReasonText(ticket.startReason);
      return { argv, command, folder: displayFolder(folder, deps.home), warning };
    },
    async launch(projectId, ticketKey) {
      const slot = `${projectId}/${ticketKey}`;
      if (launching.has(slot)) throw new KiboError("T3_THREAD_ACTIVE", `${ticketKey} is being launched`);
      launching.add(slot);
      try {
        return await launchOnce(projectId, ticketKey);
      } finally {
        launching.delete(slot);
      }
    },
    threadOf(projectId, ticketKey) {
      const ticket = ticketOf(deps.project(projectId).tickets, ticketKey);
      return deps.store.threadOf(projectId, ticket.id);
    },
    refresh: deps.poll.refresh,
  };
}

function handle(api: T3Api, req: T3RpcRequest): unknown {
  switch (req.method) {
    case "t3.status":
      return api.status();
    case "t3.preview":
      return api.preview(req.projectId, req.ticketKey);
    case "t3.launch":
      return api.launch(req.projectId, req.ticketKey);
    case "t3.threadOf":
      return api.threadOf(req.projectId, req.ticketKey);
    case "t3.refresh":
      return api.refresh(req.projectId);
  }
}

const isT3Request = (req: { method: string }): req is T3RpcRequest =>
  (T3_RPC_METHODS as readonly string[]).includes(req.method);

export function t3Rpc(api: T3Api): RpcExtension {
  return {
    methods: T3_RPC_METHODS,
    async handle(req, ctx) {
      if (!isT3Request(req)) throw new KiboError("INTERNAL", `${req.method} is not a T3 method`);
      requireLocal(ctx);
      return handle(api, req);
    },
  };
}
