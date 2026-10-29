import { type SprintView, sortSprints, type TicketView } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import { frSprints } from "../fr-sprints";
import { type Connect, findProject, printJson, type SessionIo, withClient } from "./daemon-session";
import { missingProject } from "./project-hint";

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

async function listCommand(client: DaemonClient, wanted: string, flags: Parsed["flags"], io: SessionIo) {
  const project = findProject(await client.rpc({ method: "listProjects" }), wanted);
  if (!project) {
    io.err(frTickets.projectNotFound(wanted));
    return 1;
  }
  const snapshot = await client.rpc({ method: "getProject", projectId: project.id });
  const sprints = summarizeSprints(snapshot.sprints, snapshot.tickets);
  if (flags.json === true) printJson(io, sprints);
  else for (const s of sprints) io.out(sprintLine(s));
  return 0;
}

export async function sprintsCommand(
  positional: readonly string[],
  flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
): Promise<number> {
  const [sub] = positional;
  const project = flags.project;
  if (sub === "list" && project === undefined) return missingProject(io, frSprints.usage, connect);
  if (sub !== "list" || typeof project !== "string") {
    io.err(frSprints.usage);
    return 2;
  }
  return withClient(io, (client) => listCommand(client, project, flags, io), connect);
}
