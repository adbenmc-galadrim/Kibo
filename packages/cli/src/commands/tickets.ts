import { existsSync } from "node:fs";
import { KiboError, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import type { Parsed } from "../args";
import { connectDaemon, type DaemonClient, daemonInfoFile } from "../daemon-client";
import { fr, frTickets } from "../fr";
import { briefFile, detailExtras, notesOrEmpty } from "../tickets/ticket-detail";
import { type Assignments, parseAssignments, prCommand, statusCommand } from "../tickets/ticket-set";
import { detailLines, listLine, type TicketDetail } from "../tickets/ticket-text";
import {
  isReady,
  lookupTicket,
  matchesStatus,
  statusFilter,
  summarize,
  type TicketSummary,
} from "../tickets/ticket-view";

export type TicketsIo = { home: string; out(line: string): void; err(line: string): void };
type Flags = Parsed["flags"];
type Context = { client: DaemonClient; snapshot: ProjectSnapshot; flags: Flags; io: TicketsIo };

const SUBCOMMANDS = new Set(["list", "get", "set"]);

function connectionMessage(e: unknown, io: TicketsIo): string | null {
  if (!(e instanceof KiboError)) return null;
  if (e.code === "DAEMON_NOT_RUNNING") return frTickets.notRunning;
  if (e.code === "UNAUTHORIZED") return fr.pairingFailed;
  if (e.code === "STORE_CORRUPT") return fr.daemonInfoCorrupt(daemonInfoFile(io.home));
  return null;
}

export function findProject(projects: readonly ProjectSummary[], wanted: string): ProjectSummary | null {
  const folded = wanted.trim().toLowerCase();
  return (
    projects.find((p) => p.id === wanted) ??
    projects.find((p) => p.key.toLowerCase() === folded) ??
    projects.find((p) => p.name.toLowerCase() === folded) ??
    null
  );
}

const printJson = (io: TicketsIo, value: unknown) => io.out(JSON.stringify(value, null, 2));

function listCommand({ snapshot, flags, io }: Context): number {
  const wanted = typeof flags.status === "string" ? statusFilter(flags.status) : null;
  const tickets = summarize(snapshot)
    .filter((t) => flags.ready !== true || isReady(t))
    .filter((t) => wanted === null || matchesStatus(t, wanted));
  if (flags.json === true) printJson(io, tickets);
  else for (const t of tickets) io.out(listLine(t));
  return 0;
}

function summaryOf(snapshot: ProjectSnapshot, id: string): TicketSummary {
  const found = summarize(snapshot).find((t) => t.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `ticket ${id} vanished`);
  return found;
}

async function getCommand(ident: string, { client, snapshot, flags, io }: Context): Promise<number> {
  const ticket = lookupTicket(snapshot.tickets, ident);
  if (!ticket) return notFound(ident, io);
  const projectId = snapshot.meta.id;
  const info = await client.rpc({ method: "getNotesDir", projectId });
  const notes = await notesOrEmpty(
    () => client.rpc({ method: "listNotes", projectId }),
    () => io.err(frTickets.notesUnavailable),
  );
  const summary = summaryOf(snapshot, ticket.id);
  const brief = briefFile(info.dir, summary.planId);
  const detail: TicketDetail = {
    ...summary,
    description: ticket.description,
    ...detailExtras(summary, snapshot, notes, brief !== null && existsSync(brief) ? brief : null),
  };
  if (flags.json === true) printJson(io, detail);
  else for (const line of detailLines(detail)) io.out(line);
  return 0;
}

function notFound(ident: string, io: TicketsIo): number {
  io.err(frTickets.ticketNotFound(ident));
  return 1;
}

async function applySet(set: Assignments, ident: string, ctx: Context): Promise<number> {
  const { client, snapshot, flags, io } = ctx;
  const ticket = lookupTicket(snapshot.tickets, ident);
  if (!ticket) return notFound(ident, io);
  const projectId = snapshot.meta.id;
  const changes: string[] = [];
  const status = statusCommand(ticket, set, frTickets.defaultBlockedReason);
  const pr = set.pr === null ? null : prCommand(ticket, set.pr, snapshot.tickets);
  if (status) {
    await client.rpc({ method: "command", projectId, command: status });
    changes.push(`status=${set.status}`);
  }
  if (pr) {
    await client.rpc({ method: "command", projectId, command: pr });
    changes.push(`pr=${set.pr}`);
  }
  if (flags.json === true) {
    const fresh = await client.rpc({ method: "getProject", projectId });
    printJson(io, summaryOf(fresh, ticket.id));
  } else io.out(frTickets.updated(ticket.keyLabel, changes));
  return 0;
}

function assignmentsOrUsage(args: readonly string[], io: TicketsIo): Assignments | null {
  try {
    return parseAssignments(args);
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    io.err(fr.error(e.code, e.detail));
    io.err(frTickets.usage);
    return null;
  }
}

async function withClient(io: TicketsIo, run: (client: DaemonClient) => Promise<number>): Promise<number> {
  let client: DaemonClient;
  try {
    client = await connectDaemon(io.home);
  } catch (e) {
    const message = connectionMessage(e, io);
    if (message === null) throw e;
    io.err(message);
    return 1;
  }
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

export async function runTicketsCommand(positional: string[], flags: Flags, io: TicketsIo): Promise<number> {
  const [sub, ident, ...rest] = positional;
  const project = flags.project;
  if (
    sub === undefined ||
    !SUBCOMMANDS.has(sub) ||
    typeof project !== "string" ||
    (sub !== "list" && !ident)
  ) {
    io.err(frTickets.usage);
    return 2;
  }
  const set = sub === "set" ? assignmentsOrUsage(rest, io) : null;
  if (sub === "set" && set === null) return 2;
  return withClient(io, async (client) => {
    const summary = findProject(await client.rpc({ method: "listProjects" }), project);
    if (!summary) {
      io.err(frTickets.projectNotFound(project));
      return 1;
    }
    const snapshot = await client.rpc({ method: "getProject", projectId: summary.id });
    const ctx = { client, snapshot, flags, io };
    if (sub === "list") return listCommand(ctx);
    if (set !== null) return applySet(set, ident ?? "", ctx);
    return getCommand(ident ?? "", ctx);
  });
}
