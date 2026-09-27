import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateForSharing } from "@kibo/core";
import { type ChangeMessage, type PresenceRun, SYNC_LIMITS } from "@kibo/schema";
import { startTestSyncServer, type TestSyncServer } from "@kibo/sync-server/testing";
import { fromBase64, toBase64 } from "@kibo/trust";
import { wirePresence, wireSharing } from "../collab/bootstrap";
import type { PresenceHub } from "../collab/presence";
import { createProjectHosts } from "../collab/project-hosts";
import { handleSyncRpc } from "../collab/rpc";
import type { ShareDeps } from "../collab/share";
import { docFromServer } from "../collab/sync-blob";
import { SyncClient } from "../collab/sync-client";
import { openSyncDb, type SyncDb } from "../collab/sync-db";
import { createWebSocketTransport, type SyncTransport } from "../collab/transport";
import type { ProjectHostRegistry } from "../collab/types";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import type { RpcHandler } from "../rpc-extensions";
import { createService, type Service } from "../service";
import { openStore } from "../store";

export type HarnessDaemon = {
  home: string;
  service: Service;
  hosts: ProjectHostRegistry;
  client: SyncClient;
  secrets: MemorySecretStore;
  syncDb: SyncDb;
  share: ShareDeps;
  presence: PresenceHub;
  runs: FakeRuns;
  handler: RpcHandler;
  events: ChangeMessage[];
  opens(): number;
  stop(): void;
};
export type FakeRun = PresenceRun & { projectId: string; ticketId: string };
export type FakeRuns = {
  active(): FakeRun[];
  set(runs: FakeRun[]): void;
  onChange(listener: () => void): () => void;
};
export type SyncHarness = {
  readonly server: TestSyncServer;
  caFile: string;
  daemons: HarnessDaemon[];
  connect(i: number, name: string): Promise<void>;
  shareRaw(i: number, projectId: string): Promise<void>;
  inviteRaw(i: number, projectId: string, role: "editor" | "viewer"): Promise<string>;
  joinRaw(j: number, code: string): Promise<string>;
  stopServer(): Promise<void>;
  startServer(): Promise<void>;
  waitUntil(predicate: () => boolean, timeoutMs?: number): Promise<void>;
  stop(): Promise<void>;
};

const USERS = ["adam", "lea", "sam"];

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`condition not met within ${timeoutMs} ms`);
    await Bun.sleep(20);
  }
}

function countingTransport(inner: SyncTransport): SyncTransport & { opened: number } {
  const counting = {
    opened: 0,
    open: (url: string, opts: { ca: string | null }) => {
      counting.opened += 1;
      return inner.open(url, opts);
    },
  };
  return counting;
}

function fakeRuns(): FakeRuns {
  let current: FakeRun[] = [];
  const listeners = new Set<() => void>();
  return {
    active: () => current,
    set: (runs) => {
      current = runs;
      for (const l of listeners) l();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function startDaemon(user: string, presenceTimeoutMs: number): HarnessDaemon {
  const home = mkdtempSync(join(tmpdir(), `kibo-sync-${user}-`));
  const store = openStore(home);
  const syncDb = openSyncDb(store.db);
  const secrets = createMemorySecretStore(createRedactor());
  const transport = countingTransport(createWebSocketTransport());
  const events: ChangeMessage[] = [];
  const service = createService(store, { user });
  const hosts = createProjectHosts(service.docs, user);
  const client = new SyncClient({
    db: syncDb,
    secrets,
    hosts,
    transport,
    fetchImpl: fetch,
    readFile: (path) => Bun.file(path).text(),
    now: Date.now,
    random: Math.random,
    setTimer: (fn, ms) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    },
    emit: (message) => {
      events.push(message);
      service.docs.emit(message);
    },
    log: (message, error) => console.error(`[harness:${user}] ${message}`, error ?? ""),
    backoff: { minMs: 20, maxMs: 200 },
  });
  const sharing = wireSharing({ service, store, db: syncDb, client, hosts, user });
  const runs = fakeRuns();
  const presence = wirePresence({
    client,
    db: syncDb,
    runs: (projectId) =>
      runs
        .active()
        .filter((r) => r.projectId === projectId)
        .map(({ ticketKey, profile, state }) => ({ ticketKey, profile, state })),
    emit: (message) => {
      events.push(message);
      service.docs.emit(message);
    },
    log: (message, error) => console.error(`[harness:${user}] ${message}`, error ?? ""),
    timeoutMs: presenceTimeoutMs,
  });
  const offRuns = runs.onChange(() => presence.presence.refreshRuns());
  return {
    home,
    service,
    hosts,
    client,
    secrets,
    syncDb,
    share: sharing.share,
    presence: presence.presence,
    runs,
    handler: (req, ctx) => handleSyncRpc(client, req, ctx, sharing.share, presence.presence),
    events,
    opens: () => transport.opened,
    stop: () => {
      offRuns();
      presence.stop();
      client.stop();
      sharing.stop();
      store.close();
      rmSync(home, { recursive: true, force: true });
    },
  };
}

export async function startSyncHarness(opts: {
  daemons: number;
  presenceTimeoutMs?: number;
}): Promise<SyncHarness> {
  const presenceTimeoutMs = opts.presenceTimeoutMs ?? SYNC_LIMITS.presenceTimeoutMs;
  let server = await startTestSyncServer();
  let running = true;
  const { dataDir, cert } = server;
  const port = server.server.port;
  const caFile = join(dataDir, "ca.pem");
  writeFileSync(caFile, server.caPem, { mode: 0o600 });
  const daemons = Array.from({ length: opts.daemons }, (_, i) =>
    startDaemon(USERS[i] ?? `user${i}`, presenceTimeoutMs),
  );
  const at = (i: number): HarnessDaemon => {
    const d = daemons[i];
    if (!d) throw new Error(`no daemon ${i}`);
    return d;
  };
  return {
    get server() {
      return server;
    },
    caFile,
    daemons,
    waitUntil,
    connect: async (i, name) => {
      const code = await server.inviteAccount(name);
      await at(i).client.connect({ serverUrl: server.url, code, deviceName: name, caFile });
    },
    shareRaw: async (i, projectId) => {
      const d = at(i);
      const userId = d.client.status().user?.id;
      if (!userId) throw new Error(`daemon ${i} is not connected`);
      d.hosts.mutate(projectId, (doc) => {
        migrateForSharing(doc, { localUser: d.hosts.localUser(), userId, domains: [] });
      });
      const snapshot = toBase64(d.hosts.host(projectId).doc().export({ mode: "snapshot" }));
      const requestId = crypto.randomUUID();
      await d.client.request({ type: "share", projectId, requestId, name: projectId, snapshot }, "shared");
      d.client.attachProject(projectId, "owner");
      await waitUntil(() =>
        d.client.status().projects.some((p) => p.projectId === projectId && p.lastSyncAt !== null),
      );
    },
    inviteRaw: async (i, projectId, role) => {
      const requestId = crypto.randomUUID();
      const frame = await at(i).client.request({ type: "invite", projectId, requestId, role }, "invite-code");
      return frame.code;
    },
    joinRaw: async (j, code) => {
      const d = at(j);
      const requestId = crypto.randomUUID();
      const joined = await d.client.request({ type: "redeem", requestId, code }, "joined");
      const received = new Promise<Uint8Array>((resolve) => {
        const off = d.client.onFrame((f) => {
          if (f.type !== "update" || f.projectId !== joined.projectId) return;
          off();
          resolve(fromBase64(f.bytes));
        });
      });
      d.client.send({ type: "subscribe", projectId: joined.projectId, version: null });
      const bytes = await received;
      d.client.send({ type: "unsubscribe", projectId: joined.projectId });
      d.hosts.addJoinedProject(docFromServer(joined.projectId, bytes), null);
      d.client.attachProject(joined.projectId, joined.role);
      return joined.projectId;
    },
    stopServer: async () => {
      running = false;
      await server.stop({ keepData: true });
    },
    startServer: async () => {
      server = await startTestSyncServer({ dataDir, port, cert });
      running = true;
    },
    stop: async () => {
      for (const d of daemons) d.stop();
      if (running) await server.stop();
      else rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
