import { type ProjectSnapshot, type SprintView, sortSprints, type TicketView } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import { frSprints } from "../fr-sprints";
import { dateProblem, type SprintRequest, sprintRequest } from "../sprints/sprint-request";
import { type Connect, findProject, printJson, type SessionIo, withClient } from "./daemon-session";
import { missingProject } from "./project-hint";
import { runSprintRequest } from "./sprints-write";

const SUBCOMMANDS = new Set(["list", "create", "update", "assign"]);

type SprintSummary = Pick<SprintView, "id" | "code" | "name" | "start" | "end" | "state"> & {
  features: string[];
};

function summarizeSprints(sprints: readonly SprintView[], tickets: readonly TicketView[]): SprintSummary[] {
  const keys = new Map(tickets.map((t) => [t.id, t.keyLabel]));
  return sortSprints(sprints).map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    start: s.start,
    end: s.end,
    state: s.state,
    features: s.features.map((id) => keys.get(id) ?? id),
  }));
}

const sprintLine = (s: SprintSummary): string =>
  [s.code, s.name, s.start, s.end, s.state, s.features.length === 0 ? "-" : s.features.join(",")].join("\t");

function listCommand(snapshot: ProjectSnapshot, flags: Parsed["flags"], io: SessionIo): number {
  const sprints = summarizeSprints(snapshot.sprints, snapshot.tickets);
  if (flags.json === true) printJson(io, sprints);
  else for (const s of sprints) io.out(sprintLine(s));
  return 0;
}

async function withProject(
  client: DaemonClient,
  wanted: string,
  io: SessionIo,
  run: (snapshot: ProjectSnapshot) => Promise<number> | number,
): Promise<number> {
  const project = findProject(await client.rpc({ method: "listProjects" }), wanted);
  if (!project) {
    io.err(frTickets.projectNotFound(wanted));
    return 1;
  }
  return run(await client.rpc({ method: "getProject", projectId: project.id }));
}

function usage(io: SessionIo): number {
  io.err(frSprints.usage);
  return 2;
}

function writeRequest(
  positional: readonly string[],
  flags: Parsed["flags"],
  io: SessionIo,
): SprintRequest | number {
  const req = sprintRequest(positional, flags);
  if (req === null) return usage(io);
  const problem = dateProblem(req);
  if (problem === null) return req;
  io.err(problem);
  return 1;
}

export async function sprintsCommand(
  positional: readonly string[],
  flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
): Promise<number> {
  const [sub] = positional;
  const project = flags.project;
  if (sub === undefined || !SUBCOMMANDS.has(sub)) return usage(io);
  if (project === undefined) return missingProject(io, frSprints.usage, connect);
  if (typeof project !== "string") return usage(io);
  const req = sub === "list" ? null : writeRequest(positional, flags, io);
  if (typeof req === "number") return req;
  return withClient(
    io,
    (client) =>
      withProject(client, project, io, (snapshot) =>
        req === null
          ? listCommand(snapshot, flags, io)
          : runSprintRequest(req, { client, snapshot, flags, io }),
      ),
    connect,
  );
}
