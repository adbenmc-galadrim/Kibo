import {
  type ChangeMessage,
  type ClientFrame,
  type DeviceInfo,
  KiboError,
  type MemberInfo,
  type MemberRole,
  type RejectCode,
  type ServerFrame,
  SYNC_LIMITS,
  type SyncStatus,
} from "@kibo/schema";
import type { SecretStore } from "../integrations/types";
import { clearDeviceKeys, createDeviceKeys } from "./device-keys";
import { ProjectSync } from "./project-sync";
import { SyncConnection } from "./sync-connection";
import type { SyncDb } from "./sync-db";
import { joinServer } from "./sync-join";
import { SyncProjects } from "./sync-projects";
import { RequestTable, type Timer } from "./sync-requests";
import { assertSyncUrl, type SyncTransport } from "./transport";
import type { ProjectHostRegistry } from "./types";

export { backoffDelay } from "./sync-connection";

export type SyncClientDeps = {
  db: SyncDb;
  secrets: SecretStore;
  hosts: ProjectHostRegistry;
  transport: SyncTransport;
  fetchImpl: typeof fetch;
  readFile(path: string): Promise<string>;
  now(): number;
  random(): number;
  setTimer: Timer;
  emit(message: ChangeMessage): void;
  log(message: string, error?: unknown): void;
  backoff?: { minMs: number; maxMs: number };
};
type Welcome = Extract<ServerFrame, { type: "welcome" }>;

const REQUEST_TIMEOUT_MS = 10_000;

export class SyncClient {
  private user: { id: string; name: string } | null = null;
  private offLocal: (() => void) | null = null;
  private readonly syncs = new Map<string, ProjectSync>();
  private readonly projects: SyncProjects;
  private readonly requests: RequestTable;
  private readonly connection: SyncConnection;
  private readonly listeners = new Set<(frame: ServerFrame) => void>();

  constructor(private readonly deps: SyncClientDeps) {
    this.projects = new SyncProjects(deps);
    this.requests = new RequestTable(deps.setTimer);
    const limits = deps.backoff ?? { minMs: SYNC_LIMITS.backoffMinMs, maxMs: SYNC_LIMITS.backoffMaxMs };
    this.connection = new SyncConnection(deps, limits, {
      frame: (frame) => this.receive(frame),
      dropped: (error) => {
        for (const sync of this.syncs.values()) sync.disconnected();
        this.requests.failAll(error);
      },
    });
  }

  async start(): Promise<void> {
    this.offLocal ??= this.deps.hosts.onLocalChange((id) => this.syncs.get(id)?.localChange());
    this.projects.applyAllAccess();
    this.connection.start();
  }

  stop(): void {
    this.offLocal?.();
    this.offLocal = null;
    this.connection.stop();
  }

  status(): SyncStatus {
    const config = this.deps.db.config();
    return {
      state: config ? this.connection.state : "unconfigured",
      serverUrl: config?.serverUrl ?? null,
      user: this.user ?? (config ? { id: config.userId, name: config.displayName } : null),
      deviceId: config?.deviceId ?? null,
      retryAt: this.connection.retryAt,
      lastError: this.connection.lastError,
      projects: this.projects.statuses(),
    };
  }

  membersOf(projectId: string): MemberInfo[] {
    return this.projects.membersOf(projectId);
  }

  async connect(input: {
    serverUrl: string;
    code: string;
    deviceName: string;
    caFile: string | null;
  }): Promise<SyncStatus> {
    const url = assertSyncUrl(input.serverUrl);
    if (this.deps.db.config()) throw new KiboError("INVALID_INPUT", "a sync server is already configured");
    const serverUrl = url.toString().replace(/\/$/, "");
    const ca = input.caFile ? await this.deps.readFile(input.caFile) : null;
    const keys = await createDeviceKeys(this.deps.secrets);
    const request = { code: input.code, publicKey: keys.publicKey, deviceName: input.deviceName };
    const joined = await joinServer(this.deps.fetchImpl, { serverUrl, ca, request }).catch(
      async (e: unknown) => {
        await clearDeviceKeys(this.deps.secrets);
        throw e;
      },
    );
    this.deps.db.setConfig({
      serverUrl,
      caFile: input.caFile,
      userId: joined.userId,
      deviceId: joined.deviceId,
      displayName: joined.name,
    });
    this.connection.reset();
    const online = this.connection.waitOnline();
    await this.start();
    await online;
    return this.status();
  }

  async disconnect(): Promise<void> {
    this.stop();
    for (const row of this.projects.rows()) {
      if (!row.accessRevoked) this.projects.revoke(row.projectId, "disconnected");
    }
    this.syncs.clear();
    await clearDeviceKeys(this.deps.secrets);
    this.deps.db.setConfig(null);
    this.user = null;
    this.connection.reset();
    this.deps.emit({ type: "collab.changed" });
  }

  send(frame: ClientFrame): void {
    this.connection.send(frame);
  }

  request<T extends ServerFrame["type"]>(
    frame: ClientFrame,
    expect: T,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Extract<ServerFrame, { type: T }>> {
    if (!("requestId" in frame)) {
      return Promise.reject(new KiboError("INVALID_INPUT", `${frame.type} is not a request`));
    }
    const pending = this.requests.track(frame.requestId, expect, timeoutMs);
    try {
      this.send(frame);
    } catch (e) {
      const error = e instanceof KiboError ? e : new KiboError("INTERNAL", String(e));
      this.requests.forget(frame.requestId, error);
    }
    return pending;
  }

  onFrame(listener: (frame: ServerFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  attachProject(projectId: string, role: MemberRole): void {
    this.projects.attach(projectId, role);
    if (this.connection.state === "online") this.startProject(projectId).connected();
  }

  detachProject(projectId: string): void {
    this.syncs.get(projectId)?.disconnected();
    this.syncs.delete(projectId);
    this.projects.detach(projectId);
  }

  async addDevice(): Promise<{ code: string; expiresAt: number }> {
    const f = await this.request({ type: "device-invite", requestId: crypto.randomUUID() }, "invite-code");
    return { code: f.code, expiresAt: f.expiresAt };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const f = await this.request({ type: "list-devices", requestId: crypto.randomUUID() }, "devices");
    return f.devices;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.request({ type: "revoke-device", requestId: crypto.randomUUID(), deviceId }, "done");
  }

  private receive(f: ServerFrame): void {
    this.route(f);
    for (const listener of this.listeners) listener(f);
  }

  private route(f: ServerFrame): void {
    switch (f.type) {
      case "welcome":
        this.welcome(f);
        return;
      case "update":
        this.receiveUpdate(f);
        return;
      case "ack":
        this.syncs.get(f.projectId)?.receive(f);
        if (this.syncs.has(f.projectId)) this.projects.synced(f.projectId, true);
        return;
      case "reject":
        this.syncs.get(f.projectId)?.receive(f);
        return;
      case "members":
        this.projects.setMembers(f.projectId, f.members, this.user?.id ?? null);
        return;
      case "revoked":
        this.revoke(f.projectId, f.reason);
        return;
      case "challenge":
      case "presence":
        return;
      default:
        if (!this.requests.settle(f) && f.type === "error") {
          this.deps.log(`sync server error: ${f.code} ${f.message}`);
        }
    }
  }

  private receiveUpdate(f: Extract<ServerFrame, { type: "update" }>): void {
    const sync = this.syncs.get(f.projectId);
    if (!sync) return;
    const wasResyncing = sync.resyncing;
    sync.receive(f);
    this.projects.synced(f.projectId, false);
    if (wasResyncing && !sync.resyncing) {
      this.deps.log(`local changes of ${f.projectId} were dropped by a resync from the server`);
      this.projects.failed(f.projectId, "UPDATE_REJECTED");
    }
  }

  private welcome(f: Welcome): void {
    this.user = { id: f.userId, name: f.name };
    const listed = new Map(f.projects.map((p) => [p.id, p.role]));
    for (const row of this.projects.rows()) {
      if (!row.enabled || row.accessRevoked) continue;
      const role = listed.get(row.projectId);
      if (!role) {
        this.revoke(row.projectId, "removed");
        continue;
      }
      this.projects.setRole(row.projectId, role);
      this.startProject(row.projectId).connected();
    }
    this.deps.emit({ type: "collab.changed" });
  }

  private startProject(projectId: string): ProjectSync {
    const existing = this.syncs.get(projectId);
    if (existing) return existing;
    const sync = new ProjectSync({
      projectId,
      host: this.deps.hosts.host(projectId),
      send: (frame) => this.send(frame),
      serverVersion: this.projects.row(projectId)?.lastServerVersion ?? null,
      saveServerVersion: (version) => this.projects.saveServerVersion(projectId, version),
      newBatchId: () => crypto.randomUUID(),
      schedule: (fn, ms) => {
        this.deps.setTimer(fn, ms);
      },
      onRejected: (code, message) => this.rejected(projectId, code, message),
    });
    this.syncs.set(projectId, sync);
    return sync;
  }

  private rejected(projectId: string, code: RejectCode, message: string): void {
    this.deps.log(`sync push rejected for ${projectId}: ${code} ${message}`);
    this.projects.failed(projectId, code);
    if (code === "FORBIDDEN") this.deps.hosts.setAccess(projectId, "read-only");
  }

  private revoke(projectId: string, reason: "removed" | "deleted"): void {
    this.syncs.get(projectId)?.disconnected();
    this.syncs.delete(projectId);
    this.projects.revoke(projectId, reason);
  }
}
