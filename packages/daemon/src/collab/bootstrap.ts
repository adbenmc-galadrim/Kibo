import { listDomains, listGuidelines } from "@kibo/core/agent-config";
import {
  type AgentsState,
  type ChangeMessage,
  type PresenceRun,
  type ProjectSyncInfo,
  type RunView,
  SYNC_LIMITS,
} from "@kibo/schema";
import type { Docs } from "../docs";
import type { SecretStore } from "../integrations/types";
import { createProjectSettings } from "../notes/settings";
import type { RpcHandler } from "../rpc-extensions";
import type { Service } from "../service";
import type { Store } from "../store";
import { PresenceHub, presenceRuns, routePresenceFrames } from "./presence";
import { createProjectHosts } from "./project-hosts";
import { projectSyncInfo } from "./project-info";
import { handleSyncRpc } from "./rpc";
import type { ShareDeps } from "./share";
import { SyncClient } from "./sync-client";
import { openSyncDb, type SyncDb } from "./sync-db";
import { createWebSocketTransport } from "./transport";
import type { ProjectHostRegistry } from "./types";

export type CollabDeps = {
  store: Store;
  service: Service;
  user: string;
  secrets: SecretStore;
  log?(message: string, error?: unknown): void;
};

export function workspaceDomains(docs: Docs): ShareDeps["domains"] {
  return () => {
    const guidelines = listGuidelines(docs.workspace);
    return listDomains(docs.workspace).map((domain) => ({
      domain,
      guidelines: guidelines
        .filter((g) => g.owner.scope === "domain" && g.owner.domainId === domain.id)
        .map((g) => ({ path: g.path, content: g.content })),
    }));
  };
}

export function wireSharing(input: {
  service: Service;
  store: Store;
  db: SyncDb;
  client: SyncClient;
  hosts: ProjectHostRegistry;
  user: string;
}): { share: ShareDeps; stop(): void } {
  const { service, db, client, hosts } = input;
  const syncInfo = (projectId: string) =>
    projectSyncInfo({
      row: db.project(projectId),
      doc: hosts.host(projectId).doc(),
      members: client.membersOf(projectId),
    });
  const detach = service.attachCollab({
    syncInfo: (projectId, doc) =>
      projectSyncInfo({ row: db.project(projectId), doc, members: client.membersOf(projectId) }),
  });
  const restoreIdentity = service.docs.setIdentity((projectId) => {
    const config = db.config();
    return db.project(projectId) && config ? config.userId : input.user;
  });
  const share: ShareDeps = {
    client,
    db,
    hosts,
    domains: workspaceDomains(service.docs),
    settings: createProjectSettings(input.store.db),
    syncInfo,
  };
  return {
    share,
    stop: () => {
      restoreIdentity();
      detach();
    },
  };
}

export type RunSource = { state(): AgentsState; onRunState(listener: (run: RunView) => void): () => void };

export function wirePresence(input: {
  client: SyncClient;
  db: SyncDb;
  runs(projectId: string): PresenceRun[];
  emit(message: ChangeMessage): void;
  log(message: string, error?: unknown): void;
  timeoutMs: number;
}): { presence: PresenceHub; stop(): void } {
  const { client, db, log } = input;
  const presence = new PresenceHub({
    send: (frame) => client.send(frame),
    identity: () => {
      const s = client.status();
      return s.user && s.deviceId ? { userId: s.user.id, name: s.user.name, deviceId: s.deviceId } : null;
    },
    runs: input.runs,
    members: (projectId) => client.membersOf(projectId),
    shared: (projectId) => {
      const row = db.project(projectId);
      return row?.enabled === true && !row.accessRevoked;
    },
    online: () => client.status().state === "online",
    emit: input.emit,
    log,
    timeoutMs: input.timeoutMs,
  });
  const offFrames = routePresenceFrames(client, presence, log);
  return {
    presence,
    stop: () => {
      offFrames();
      presence.dispose();
    },
  };
}

const defaultLog = (message: string, error?: unknown) =>
  console.error(`[kibo-daemon] ${message}`, ...(error === undefined ? [] : [error]));

export async function startCollab(deps: CollabDeps): Promise<{
  client: SyncClient;
  hosts: ProjectHostRegistry;
  handler: RpcHandler;
  presence: PresenceHub;
  syncInfo(projectId: string): ProjectSyncInfo;
  attachRuns(source: RunSource): () => void;
  stop(): void;
}> {
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
  const sharing = wireSharing({ ...deps, db, client, hosts });
  let runSource: RunSource | null = null;
  const presence = wirePresence({
    client,
    db,
    runs: (projectId) => (runSource ? presenceRuns(runSource.state().runs, projectId) : []),
    emit: (message) => deps.service.docs.emit(message),
    log: deps.log ?? defaultLog,
    timeoutMs: SYNC_LIMITS.presenceTimeoutMs,
  });
  const presenceTimer = setInterval(() => presence.presence.tick(), SYNC_LIMITS.presenceRefreshMs);
  await client.start();
  return {
    client,
    hosts,
    handler: (req, ctx) => handleSyncRpc(client, req, ctx, sharing.share, presence.presence),
    presence: presence.presence,
    syncInfo: sharing.share.syncInfo,
    attachRuns: (source) => {
      runSource = source;
      const off = source.onRunState(() => presence.presence.refreshRuns());
      return () => {
        off();
        if (runSource === source) runSource = null;
      };
    },
    stop: () => {
      clearInterval(presenceTimer);
      presence.stop();
      client.stop();
      sharing.stop();
    },
  };
}
