import { KiboError, type ProjectMeta } from "@kibo/schema";
import { connectDaemon, type DaemonClient, DaemonError, daemonInfoFile } from "../daemon-client";
import { fr, frTickets } from "../fr";

export type SessionIo = { home: string; out(line: string): void; err(line: string): void };
export type Connect = (home: string) => Promise<DaemonClient>;

function connectionMessage(e: unknown, home: string): string | null {
  if (!(e instanceof KiboError)) return null;
  if (e.code === "DAEMON_NOT_RUNNING") return frTickets.notRunning;
  if (e.code === "UNAUTHORIZED") return fr.pairingFailed;
  if (e.code === "STORE_CORRUPT") return fr.daemonInfoCorrupt(daemonInfoFile(home));
  return null;
}

async function versionOf(client: DaemonClient): Promise<{ home: string; version: string } | null> {
  try {
    const info = await client.rpc({ method: "getAppInfo" });
    return { home: info.home, version: info.version };
  } catch {
    return null;
  }
}

async function located(e: DaemonError, client: DaemonClient, home: string): Promise<DaemonError> {
  const daemon = (await versionOf(client)) ?? { home, version: null };
  return new DaemonError(e.code, e.detail, daemon);
}

export async function withClient(
  io: SessionIo,
  run: (client: DaemonClient) => Promise<number>,
  connect: Connect = connectDaemon,
): Promise<number> {
  let client: DaemonClient;
  try {
    client = await connect(io.home);
  } catch (e) {
    const message = connectionMessage(e, io.home);
    if (message === null) throw e;
    io.err(message);
    return 1;
  }
  try {
    return await run(client);
  } catch (e) {
    throw e instanceof DaemonError && e.daemon === null ? await located(e, client, io.home) : e;
  } finally {
    await client.close();
  }
}

export const printJson = (io: SessionIo, value: unknown) => io.out(JSON.stringify(value, null, 2));

export function findProject<P extends Pick<ProjectMeta, "id" | "key" | "name">>(
  projects: readonly P[],
  wanted: string,
): P | null {
  const folded = wanted.trim().toLowerCase();
  return (
    projects.find((p) => p.id === wanted) ??
    projects.find((p) => p.key.toLowerCase() === folded) ??
    projects.find((p) => p.name.toLowerCase() === folded) ??
    null
  );
}
