import type { ProjectMeta } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frProjects, frTickets } from "../fr";
import { type Connect, findProject, printJson, type SessionIo, withClient } from "./daemon-session";

type Flags = Parsed["flags"];

const projectDetail = (meta: ProjectMeta) => ({
  key: meta.key,
  name: meta.name,
  folder: meta.folder,
  worktree: meta.worktree,
  delivery: meta.delivery,
});

const detailLines = (meta: ProjectMeta): string[] => [
  frProjects.title(meta.key, meta.name),
  frProjects.folder(meta.folder),
  frProjects.worktree(meta.worktree),
  frProjects.recipe(meta.worktree?.recipe ?? null),
  frProjects.delivery(meta.delivery),
];

async function listCommand(client: DaemonClient, flags: Flags, io: SessionIo): Promise<number> {
  const projects = (await client.rpc({ method: "listProjects" })).map((p) => ({
    key: p.key,
    name: p.name,
    folder: p.folder,
  }));
  if (flags.json === true) printJson(io, projects);
  else for (const p of projects) io.out(`${p.key}\t${p.name}\t${p.folder ?? ""}`);
  return 0;
}

async function getCommand(
  client: DaemonClient,
  wanted: string,
  flags: Flags,
  io: SessionIo,
): Promise<number> {
  const summary = findProject(await client.rpc({ method: "listProjects" }), wanted);
  if (!summary) {
    io.err(frTickets.projectNotFound(wanted));
    return 1;
  }
  const { meta } = await client.rpc({ method: "getProject", projectId: summary.id });
  if (flags.json === true) printJson(io, projectDetail(meta));
  else for (const line of detailLines(meta)) io.out(line);
  return 0;
}

export async function projectsCommand(
  positional: readonly string[],
  flags: Flags,
  io: SessionIo,
  connect?: Connect,
): Promise<number> {
  const [sub, wanted] = positional;
  if (sub === "list") return withClient(io, (client) => listCommand(client, flags, io), connect);
  if (sub === "get" && wanted !== undefined)
    return withClient(io, (client) => getCommand(client, wanted, flags, io), connect);
  io.err(frProjects.usage);
  return 2;
}
