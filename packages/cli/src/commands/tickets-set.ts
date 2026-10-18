import {
  type GitBranchRef,
  type GithubPrRef,
  KiboError,
  type ProjectSnapshot,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { fr, frTickets } from "../fr";
import {
  type Assignments,
  branchRef,
  branchToDeclare,
  parseAssignments,
  prRef,
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

type Declaration = { ref: GitBranchRef | GithubPrRef; change: string };

function declarationsOf(req: SetRequest, ticket: TicketView, ctx: TicketsContext): Declaration[] {
  const declarations: Declaration[] = [];
  const branch = req.branch === null ? null : branchToDeclare(ticket, req.branch);
  if (branch !== null)
    declarations.push({ ref: branch, change: frTickets.branchChange(branch.branch, branch.base) });
  const pr = req.set.pr === null ? null : prRef(ticket, req.set.pr, ctx.snapshot.tickets);
  if (pr !== null) declarations.push({ ref: pr, change: frTickets.prChange(pr.number) });
  return declarations;
}

const statusLabel = (snapshot: ProjectSnapshot, statusId: StatusId): string =>
  snapshot.workflow.find((s) => s.id === statusId)?.label ?? statusId;

export async function applySet(req: SetRequest, ident: string, ctx: TicketsContext): Promise<number> {
  const { client, snapshot, flags, io } = ctx;
  const ticket = lookupTicket(snapshot.tickets, ident);
  if (!ticket) return notFound(ident, io);
  const projectId = snapshot.meta.id;
  const changes: string[] = [];
  const status = statusCommand(ticket, req.set, frTickets.defaultBlockedReason);
  if (status !== null) {
    await client.rpc({ method: "command", projectId, command: status });
    changes.push(frTickets.statusChange(req.set.status ?? status.statusId));
  }
  let moved: StatusId | null = null;
  for (const { ref, change } of declarationsOf(req, ticket, ctx)) {
    const ticketKey = ticket.key ?? ident;
    const result = await client.rpc({ method: "declareTicketRef", projectId, ticketKey, ref });
    if (result.statusChanged) moved = result.ticket.statusId;
    changes.push(change);
  }
  if (flags.json === true) {
    const fresh = await client.rpc({ method: "getProject", projectId });
    printJson(io, summaryOf(fresh, ticket.id));
  } else
    io.out(frTickets.updated(ticket.keyLabel, changes, moved === null ? null : statusLabel(snapshot, moved)));
  return 0;
}
