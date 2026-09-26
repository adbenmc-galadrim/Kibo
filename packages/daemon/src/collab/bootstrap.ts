import type { SecretStore } from "../integrations/types";
import type { RpcHandler } from "../rpc-extensions";
import type { Service } from "../service";
import type { Store } from "../store";
import { createProjectHosts } from "./project-hosts";
import { projectSyncInfo } from "./project-info";
import { handleSyncRpc } from "./rpc";
import { SyncClient } from "./sync-client";
import { openSyncDb } from "./sync-db";
import { createWebSocketTransport } from "./transport";
import type { ProjectHostRegistry } from "./types";

export type CollabDeps = {
  store: Store;
  service: Service;
  user: string;
  secrets: SecretStore;
  log?(message: string, error?: unknown): void;
};

const defaultLog = (message: string, error?: unknown) =>
  console.error(`[kibo-daemon] ${message}`, ...(error === undefined ? [] : [error]));

export async function startCollab(
  deps: CollabDeps,
): Promise<{ client: SyncClient; hosts: ProjectHostRegistry; handler: RpcHandler; stop(): void }> {
  const db = openSyncDb(deps.store.db);
  const hosts = createProjectHosts(deps.service.docs, deps.user);
  const client = new SyncClient({
    db,
    secrets: deps.secrets,
    hosts,
    transport: createWebSocketTransport(),
    fetchImpl: fetch,
    readFile: (path) => Bun.file(path).text(),
    now: Date.now,
    random: Math.random,
    setTimer: (fn, ms) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    },
    emit: (message) => deps.service.docs.emit(message),
    log: deps.log ?? defaultLog,
  });
  const detach = deps.service.attachCollab({
    syncInfo: (projectId, doc) =>
      projectSyncInfo({ row: db.project(projectId), doc, members: client.membersOf(projectId) }),
  });
  await client.start();
  return {
    client,
    hosts,
    handler: (req, ctx) => handleSyncRpc(client, req, ctx),
    stop: () => {
      client.stop();
      detach();
    },
  };
}
