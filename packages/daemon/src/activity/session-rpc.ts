import {
  branchRefOf,
  DEFAULT_SESSION_TOOL,
  KiboError,
  type ProjectEventSink,
  type TicketSession,
  type TicketView,
  type TrackingRpcRequest,
} from "@kibo/schema";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import { recordStopped, startedEvent } from "./session-events";
import type { SessionStore } from "./session-store";

export type SetTicketSessionInput = Extract<TrackingRpcRequest, { method: "setTicketSession" }>;
export type SessionRpcDeps = {
  store: SessionStore;
  tickets(projectId: string): readonly TicketView[];
  branchAt(cwd: string): Promise<string | null>;
  now(): number;
  sweep(): void;
  sink?: ProjectEventSink;
  emit(projectId: string): void;
};

async function ticketOf(deps: SessionRpcDeps, req: SetTicketSessionInput, tickets: readonly TicketView[]) {
  if (req.ticketKey !== null) {
    const byKey = tickets.find((t) => t.key === req.ticketKey);
    if (!byKey) throw new KiboError("NOT_FOUND", `ticket ${req.ticketKey} not found`);
    return byKey;
  }
  if (req.cwd === null) throw new KiboError("INVALID_INPUT", "a ticket key or a folder is required");
  const branch = await deps.branchAt(req.cwd);
  if (branch === null) throw new KiboError("NOT_FOUND", `no git branch checked out in ${req.cwd}`);
  const byBranch = tickets.find((t) => branchRefOf(t.externalRefs)?.branch === branch);
  if (!byBranch) throw new KiboError("NOT_FOUND", `no ticket declares the branch ${branch}`);
  return byBranch;
}

const sessionOf = (row: { tool: string; startedAt: number } | null): TicketSession | null =>
  row === null ? null : { tool: row.tool, startedAt: row.startedAt };

export async function setTicketSession(
  deps: SessionRpcDeps,
  req: SetTicketSessionInput,
): Promise<TicketSession | null> {
  const tickets = deps.tickets(req.projectId);
  const ticket = await ticketOf(deps, req, tickets);
  deps.sweep();
  const now = deps.now();
  if (req.state === "ping") return sessionOf(deps.store.ping(req.projectId, ticket.id, now));
  if (req.state === "stop") {
    const closed = deps.store.stop(req.projectId, ticket.id, now);
    if (closed === null) return null;
    recordStopped(deps.sink, tickets, closed, "stop");
    deps.emit(req.projectId);
    return null;
  }
  const opened = deps.store.active(req.projectId, now).has(ticket.id);
  const tool = req.tool ?? DEFAULT_SESSION_TOOL;
  const row = deps.store.start(req.projectId, ticket.id, tool, now);
  if (!opened) {
    deps.sink?.record(req.projectId, startedEvent(ticket, tickets, tool));
    deps.emit(req.projectId);
  }
  return sessionOf(row);
}

export function sessionRpc(deps: SessionRpcDeps): RpcExtension {
  return {
    methods: ["setTicketSession"],
    async handle(req, ctx) {
      if (req.method !== "setTicketSession")
        throw new KiboError("INTERNAL", `${req.method} is not a ticket session method`);
      requireLocal(ctx);
      return setTicketSession(deps, req);
    },
  };
}
