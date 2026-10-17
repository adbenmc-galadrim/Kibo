import { existsSync } from "node:fs";
import type { Parsed } from "../args";
import { frTickets } from "../fr";
import { briefFile, detailExtras, notesOrEmpty } from "../tickets/ticket-detail";
import { detailLines, listLine, type TicketDetail } from "../tickets/ticket-text";
import { sprintSelector } from "../tickets/ticket-tracking";
import { isReady, lookupTicket, matchesStatus, statusFilter, summarize } from "../tickets/ticket-view";
import { type Connect, findProject, printJson, type SessionIo, withClient } from "./daemon-session";
import { notFound, summaryOf, type TicketsContext } from "./tickets-context";
import { ticketsSession } from "./tickets-session";
import { applySet, type SetRequest, setRequestOrExit } from "./tickets-set";
import { ticketsStep } from "./tickets-step";

export type TicketsIo = SessionIo;
type Flags = Parsed["flags"];

const SUBCOMMANDS = new Set(["list", "get", "set"]);

function listCommand({ snapshot, flags, io }: TicketsContext): number {
  const wanted = typeof flags.status === "string" ? statusFilter(flags.status) : null;
  const inSprint = typeof flags.sprint === "string" ? sprintSelector(flags.sprint, snapshot.sprints) : null;
  if (typeof flags.sprint === "string" && inSprint === null) {
    io.err(frTickets.sprintNotFound(flags.sprint));
    return 1;
  }
  const tickets = summarize(snapshot)
    .filter((t) => flags.ready !== true || isReady(t))
    .filter((t) => wanted === null || matchesStatus(t, wanted))
    .filter((t) => inSprint === null || inSprint(t));
  if (flags.json === true) printJson(io, tickets);
  else for (const t of tickets) io.out(listLine(t));
  return 0;
}

async function getCommand(ident: string, { client, snapshot, flags, io }: TicketsContext): Promise<number> {
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

function isUsage(sub: string | undefined, ident: string | undefined, flags: Flags): boolean {
  return (
    sub === undefined ||
    !SUBCOMMANDS.has(sub) ||
    typeof flags.project !== "string" ||
    flags.sprint === true ||
    (sub !== "list" && !ident)
  );
}

export async function runTicketsCommand(
  positional: string[],
  flags: Flags,
  io: TicketsIo,
  connect?: Connect,
): Promise<number> {
  const [sub, ident, ...rest] = positional;
  if (sub === "step") return ticketsStep(positional.slice(1), flags, io, connect);
  if (sub === "session") return ticketsSession(positional.slice(1), flags, io, connect);
  const project = flags.project;
  if (isUsage(sub, ident, flags) || typeof project !== "string") {
    io.err(frTickets.usage);
    return 2;
  }
  const request: SetRequest | number | null = sub === "set" ? setRequestOrExit(rest, io) : null;
  if (typeof request === "number") return request;
  return withClient(
    io,
    async (client) => {
      const summary = findProject(await client.rpc({ method: "listProjects" }), project);
      if (!summary) {
        io.err(frTickets.projectNotFound(project));
        return 1;
      }
      const snapshot = await client.rpc({ method: "getProject", projectId: summary.id });
      const ctx = { client, snapshot, flags, io };
      if (sub === "list") return listCommand(ctx);
      if (request !== null) return applySet(request, ident ?? "", ctx);
      return getCommand(ident ?? "", ctx);
    },
    connect,
  );
}
