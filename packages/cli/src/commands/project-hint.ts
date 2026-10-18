import { KiboError, type ProjectMeta } from "@kibo/schema";
import { connectDaemon, type DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import type { Connect, SessionIo } from "./daemon-session";

export const projectKeys = (projects: readonly Pick<ProjectMeta, "key">[]): string[] =>
  projects.map((p) => p.key);

async function knownKeys(io: SessionIo, connect: Connect): Promise<string[]> {
  let client: DaemonClient;
  try {
    client = await connect(io.home);
  } catch (e) {
    if (e instanceof KiboError) return [];
    throw e;
  }
  try {
    return projectKeys(await client.rpc({ method: "listProjects" }));
  } finally {
    await client.close();
  }
}

export async function missingProject(
  io: SessionIo,
  usage: string,
  connect: Connect = connectDaemon,
): Promise<number> {
  const keys = await knownKeys(io, connect);
  io.err(keys.length === 0 ? usage : frTickets.precise(keys));
  return 2;
}
