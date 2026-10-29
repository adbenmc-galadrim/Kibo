import { existsSync } from "node:fs";
import type { Parsed } from "../args";
import { frTickets } from "../fr";
import { briefFile, detailExtras, notesOrEmpty } from "../tickets/ticket-detail";
import { detailLines, listLines, type TicketDetail } from "../tickets/ticket-text";
import { sprintSelector } from "../tickets/ticket-tracking";
import {
  lookupTicket,
  matchesStatus,
  statusFilter,
  summarize,
  type TicketSummary,
} from "../tickets/ticket-view";
import { type Connect, printJson, type SessionIo, withClient } from "./daemon-session";
import { missingProject } from "./project-hint";
import { chooseProject, notFound, summaryOf, type TicketsContext } from "./tickets-context";
import { linkCommand, unlinkCommand } from "./tickets-link";
import { ticketsSession } from "./tickets-session";
import { applySet, type SetRequest, setRequestOrExit } from "./tickets-set";
import { ticketsStep } from "./tickets-step";
import { createCommand, moveCommand, updateCommand } from "./tickets-write";

export type TicketsIo = SessionIo;
type Flags = Parsed["flags"];

const SUBCOMMANDS = new Set(["list", "get", "set", "create", "update", "move", "link", "unlink"]);
const VALUE_FLAGS = [
  "project",
  "sprint",
  "feature",
  "label",
  "labels",
  "fields",
  "title",
  "description",
  "append",
  "prepend",
  "blocks",
];

const givenFilters = (flags: Flags): string[] => [
  ...(flags.ready === true ? ["--ready"] : []),
  ...(typeof flags.status === "string" ? [`--status ${flags.status}`] : []),
  ...(typeof flags.sprint === "string" ? [`--sprint ${flags.sprint}`] : []),
];

function listText(tickets: readonly TicketSummary[], flags: Flags): string[] {
  if (tickets.length > 0) return listLines(tickets);
  const filters = givenFilters(flags);
  return [filters.length === 0 ? frTickets.noTickets : frTickets.noMatch(filters.join(" "))];
}

function listCommand({ snapshot, flags, io }: TicketsContext): number {
  const wanted = typeof flags.status === "string" ? statusFilter(flags.status) : null;
  const inSprint = typeof flags.sprint === "string" ? sprintSelector(flags.sprint, snapshot.sprints) : null;
  if (typeof flags.sprint === "string" && inSprint === null) {
    io.err(frTickets.sprintNotFound(flags.sprint));
    return 1;
  }
  const tickets = summarize(snapshot)
    .filter((t) => flags.ready !== true || t.startable)
    .filter((t) => wanted === null || matchesStatus(t, wanted))
    .filter((t) => inSprint === null || inSprint(t));
  if (flags.json === true) printJson(io, tickets);
  else for (const line of listText(tickets, flags)) io.out(line);
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

const needsFeature = (sub: string): boolean => sub === "create" || sub === "move";

function isUsage(
  sub: string | undefined,
  ident: string | undefined,
  other: string | undefined,
  flags: Flags,
): boolean {
  return (
    sub === undefined ||
    !SUBCOMMANDS.has(sub) ||
    VALUE_FLAGS.some((name) => flags[name] === true) ||
    (sub !== "list" && !ident) ||
    (needsFeature(sub) && flags.feature === undefined) ||
    (sub === "link" && flags.blocks === undefined) ||
    (sub === "unlink" && !other)
  );
}

function subcommand(sub: string, ident: string, other: string, ctx: TicketsContext): Promise<number> {
  if (sub === "create") return createCommand(ident, ctx);
  if (sub === "update") return updateCommand(ident, ctx);
  if (sub === "move") return moveCommand(ident, ctx);
  if (sub === "link") return linkCommand(ident, ctx);
  if (sub === "unlink") return unlinkCommand(ident, other, ctx);
  return getCommand(ident, ctx);
}

export async function runTicketsCommand(
  positional: string[],
  flags: Flags,
  io: TicketsIo,
  connect?: Connect,
  cwd: string = process.cwd(),
): Promise<number> {
  const [sub, ident, ...rest] = positional;
  if (sub === "step") return ticketsStep(positional.slice(1), flags, io, connect);
  if (sub === "session") return ticketsSession(positional.slice(1), flags, io, connect);
  const project = typeof flags.project === "string" ? flags.project : undefined;
  if (isUsage(sub, ident, rest[0], flags)) {
    io.err(frTickets.usage);
    return 2;
  }
  if (sub === "list" && project === undefined) return missingProject(io, frTickets.usage, connect);
  const request: SetRequest | number | null = sub === "set" ? setRequestOrExit(rest, io) : null;
  if (typeof request === "number") return request;
  return withClient(
    io,
    async (client) => {
      const projects = await client.rpc({ method: "listProjects" });
      const choice = chooseProject(projects, sub === "create" ? "" : (ident ?? ""), project, cwd);
      if ("problem" in choice) {
        io.err(choice.problem);
        return choice.code;
      }
      const snapshot = await client.rpc({ method: "getProject", projectId: choice.project.id });
      const ctx = { client, snapshot, flags, io, cwd };
      if (sub === "list") return listCommand(ctx);
      if (request !== null) return applySet(request, ident ?? "", ctx);
      return subcommand(sub ?? "get", ident ?? "", rest[0] ?? "", ctx);
    },
    connect,
  );
}
