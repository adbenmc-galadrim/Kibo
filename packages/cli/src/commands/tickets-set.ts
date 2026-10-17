import { type GitBranchRef, KiboError, type ProjectCommand, type TicketView } from "@kibo/schema";
import { fr, frTickets } from "../fr";
import {
  type Assignments,
  branchCommand,
  branchRef,
  parseAssignments,
  prCommand,
  statusCommand,
} from "../tickets/ticket-set";
import { lookupTicket } from "../tickets/ticket-view";
import { printJson, type SessionIo } from "./daemon-session";
import { notFound, summaryOf, type TicketsContext } from "./tickets-context";

export type SetRequest = { set: Assignments; branch: GitBranchRef | null };

function reported(e: unknown, io: SessionIo): void {
  if (!(e instanceof KiboError)) throw e;
  io.err(fr.error(e.code, e.detail));
}

export function setRequestOrExit(args: readonly string[], io: SessionIo): SetRequest | number {
  let set: Assignments;
  try {
    set = parseAssignments(args);
  } catch (e) {
    reported(e, io);
    io.err(frTickets.usage);
    return 2;
  }
  try {
    return { set, branch: branchRef(set) };
  } catch (e) {
    reported(e, io);
    return 1;
  }
}

const branchChange = (ref: GitBranchRef): string =>
  ref.base === null ? `branch=${ref.branch}` : `branch=${ref.branch} base=${ref.base}`;

type Write = { command: ProjectCommand | null; change: string };

function writesOf(req: SetRequest, ticket: TicketView, ctx: TicketsContext): Write[] {
  const { set, branch } = req;
  const writes: Write[] = [
    { command: statusCommand(ticket, set, frTickets.defaultBlockedReason), change: `status=${set.status}` },
  ];
  if (branch !== null) writes.push({ command: branchCommand(ticket, branch), change: branchChange(branch) });
  if (set.pr !== null)
    writes.push({ command: prCommand(ticket, set.pr, ctx.snapshot.tickets), change: `pr=${set.pr}` });
  return writes;
}

export async function applySet(req: SetRequest, ident: string, ctx: TicketsContext): Promise<number> {
  const { client, snapshot, flags, io } = ctx;
  const ticket = lookupTicket(snapshot.tickets, ident);
  if (!ticket) return notFound(ident, io);
  const projectId = snapshot.meta.id;
  const changes: string[] = [];
  for (const { command, change } of writesOf(req, ticket, ctx)) {
    if (command === null) continue;
    await client.rpc({ method: "command", projectId, command });
    changes.push(change);
  }
  if (flags.json === true) {
    const fresh = await client.rpc({ method: "getProject", projectId });
    printJson(io, summaryOf(fresh, ticket.id));
  } else io.out(frTickets.updated(ticket.keyLabel, changes));
  return 0;
}
