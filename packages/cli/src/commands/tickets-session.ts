import {
  DEFAULT_SESSION_TOOL,
  KiboError,
  type ProjectSummary,
  SessionState,
  SessionTool,
  TicketKey,
  type TicketSession,
} from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import { clockTime } from "../tickets/ticket-text";
import { type Connect, findProject, printJson, type SessionIo, withClient } from "./daemon-session";
import { byFolder } from "./tickets-context";

type SessionRequest = { ticketKey: string | null; state: SessionState; tool: string };
type Flags = Parsed["flags"];

function parseRequest(args: readonly string[], flags: Flags): SessionRequest | null {
  const keyless = SessionState.safeParse(args[0]);
  const [rawKey, rawState, ...rest] = keyless.success ? [null, ...args] : args;
  const key = rawKey === null ? null : TicketKey.safeParse(rawKey?.trim().toUpperCase());
  const state = SessionState.safeParse(rawState);
  const tool = SessionTool.safeParse(flags.tool ?? DEFAULT_SESSION_TOOL);
  if (rest.length > 0 || !state.success || !tool.success || flags.project === true) return null;
  if (key !== null && !key.success) return null;
  return { ticketKey: key?.data ?? null, state: state.data, tool: tool.data };
}

const isNotFound = (e: unknown): boolean => e instanceof KiboError && e.code === "NOT_FOUND";

async function firstAnswer(
  client: DaemonClient,
  projects: readonly ProjectSummary[],
  req: SessionRequest,
  cwd: string,
): Promise<{ session: TicketSession | null } | null> {
  for (const project of projects) {
    try {
      const session = await client.rpc({
        method: "setTicketSession",
        projectId: project.id,
        ticketKey: req.ticketKey,
        cwd: req.ticketKey === null ? cwd : null,
        state: req.state,
        tool: req.tool,
      });
      return { session };
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }
  return null;
}

function report(req: SessionRequest, session: TicketSession | null, flags: Flags, io: SessionIo): number {
  if (flags.json === true) printJson(io, session);
  else if (session === null) io.out(frTickets.noSession);
  else if (req.state === "stop") io.out(frTickets.sessionOver(req.ticketKey));
  else io.out(frTickets.sessionOn(req.ticketKey, session.tool, clockTime(session.startedAt)));
  return 0;
}

async function sendSession(
  client: DaemonClient,
  req: SessionRequest,
  flags: Flags,
  io: SessionIo,
  cwd: string,
) {
  const projects = await client.rpc({ method: "listProjects" });
  const wanted = typeof flags.project === "string" ? flags.project : (req.ticketKey?.split("-")[0] ?? null);
  const pinned = wanted === null ? null : findProject(projects, wanted);
  if (wanted !== null && pinned === null) {
    io.err(frTickets.projectNotFound(wanted));
    return 1;
  }
  const answer = await firstAnswer(client, pinned === null ? byFolder(projects, cwd) : [pinned], req, cwd);
  if (answer === null) {
    io.err(req.ticketKey === null ? frTickets.noBranchTicket : frTickets.ticketNotFound(req.ticketKey));
    return 1;
  }
  return report(req, answer.session, flags, io);
}

export async function ticketsSession(
  args: readonly string[],
  flags: Flags,
  io: SessionIo,
  connect?: Connect,
  cwd: string = process.cwd(),
): Promise<number> {
  const req = parseRequest(args, flags);
  if (req === null) {
    io.err(frTickets.usage);
    return 2;
  }
  return withClient(io, (client) => sendSession(client, req, flags, io, cwd), connect);
}
