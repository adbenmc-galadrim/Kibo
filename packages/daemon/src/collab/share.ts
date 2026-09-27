import {
  getBinding,
  getProjectMeta,
  migrateForSharing,
  migrateForUnsharing,
  restoreLocalAllocation,
  type ShareMigrationInput,
  validateSharedSnapshot,
} from "@kibo/core";
import {
  KiboError,
  type MemberInfo,
  type MemberRole,
  type ProjectMeta,
  type ProjectSyncInfo,
  type ServerFrame,
} from "@kibo/schema";
import { fromBase64, normalizeCode, toBase64 } from "@kibo/trust";
import type { LoroDoc } from "loro-crdt";
import type { ProjectSettings } from "../notes/settings";
import { LOCAL_FOLDER_KEY } from "../project-folder";
import { docFromServer } from "./sync-blob";
import type { SyncClient } from "./sync-client";
import type { SyncDb } from "./sync-db";
import type { ProjectHostRegistry } from "./types";

export type ShareClient = Pick<
  SyncClient,
  "request" | "send" | "onFrame" | "attachProject" | "detachProject" | "status"
>;
export type ShareDeps = {
  client: ShareClient;
  db: SyncDb;
  hosts: ProjectHostRegistry;
  domains(): ShareMigrationInput["domains"];
  settings: ProjectSettings;
  syncInfo(projectId: string): ProjectSyncInfo;
  timeoutMs?: number;
};

const SHARE_TIMEOUT_MS = 30_000;
const rid = () => crypto.randomUUID();
const timeoutOf = (deps: ShareDeps) => deps.timeoutMs ?? SHARE_TIMEOUT_MS;

function requireOnline(deps: ShareDeps): { userId: string } {
  const config = deps.db.config();
  if (!config) throw new KiboError("INVALID_INPUT", "no sync server is configured");
  if (deps.client.status().state !== "online") {
    throw new KiboError("SYNC_OFFLINE", "the sync server is unreachable");
  }
  return { userId: config.userId };
}

function requireOwner(deps: ShareDeps, projectId: string): void {
  const row = deps.db.project(projectId);
  if (!row || row.accessRevoked) throw new KiboError("INVALID_INPUT", `project ${projectId} is not shared`);
  if (row.role !== "owner") throw new KiboError("FORBIDDEN", `only an owner can manage project ${projectId}`);
}

function migratedCopy(
  deps: ShareDeps,
  projectId: string,
  userId: string,
): { doc: LoroDoc; folder: string | null } {
  const doc = deps.hosts.host(projectId).doc().fork();
  const { folder } = migrateForSharing(doc, {
    localUser: deps.hosts.localUser(),
    userId,
    domains: deps.domains(),
  });
  const verdict = validateSharedSnapshot(doc, projectId, userId);
  if (!verdict.ok)
    throw new KiboError("INVALID_INPUT", `project ${projectId} cannot be shared: ${verdict.reason}`);
  return { doc, folder };
}

function shareRefusal(projectId: string, e: unknown): unknown {
  if (!(e instanceof KiboError) || e.code !== "CONFLICT") return e;
  return new KiboError(
    "CONFLICT",
    `project ${projectId} is already in use on the sync server, its first snapshot can no longer be replaced`,
  );
}

function joinRefusal(e: unknown): unknown {
  if (!(e instanceof KiboError)) return e;
  return new KiboError(
    e.code,
    `${e.detail}; the invite is used: the project owner must remove this member, then invite again`,
  );
}

export async function shareProject(deps: ShareDeps, projectId: string): Promise<ProjectSyncInfo> {
  const { userId } = requireOnline(deps);
  const row = deps.db.project(projectId);
  if (row?.enabled && !row.accessRevoked) return deps.syncInfo(projectId);
  if (row && !row.accessRevoked) {
    throw new KiboError(
      "CONFLICT",
      `project ${projectId} is already shared but its sync is suspended (${row.lastError ?? "unknown"})`,
    );
  }
  deps.hosts.assertWritable(projectId);
  const current = deps.hosts.host(projectId).doc();
  const { doc, folder } = migratedCopy(deps, projectId, userId);
  deps.hosts.setLocked(projectId, true);
  let locked = true;
  try {
    const snapshot = toBase64(doc.export({ mode: "snapshot" }));
    const name = getProjectMeta(doc).name;
    await deps.client
      .request({ type: "share", projectId, requestId: rid(), name, snapshot }, "shared", timeoutOf(deps))
      .catch((e: unknown) => {
        throw shareRefusal(projectId, e);
      });
    if (folder !== null) deps.settings.set(projectId, LOCAL_FOLDER_KEY, folder);
    deps.hosts.setLocked(projectId, false);
    locked = false;
    deps.hosts.mutate(projectId, (local) => {
      local.import(doc.export({ mode: "update", from: current.oplogVersion() }));
    });
    deps.client.attachProject(projectId, "owner");
    return deps.syncInfo(projectId);
  } finally {
    if (locked) deps.hosts.setLocked(projectId, false);
  }
}

export async function createProjectInvite(
  deps: ShareDeps,
  input: { projectId: string; role: "editor" | "viewer" },
): Promise<{ code: string; expiresAt: number }> {
  requireOnline(deps);
  requireOwner(deps, input.projectId);
  const frame = { type: "invite", projectId: input.projectId, requestId: rid(), role: input.role } as const;
  const f = await deps.client.request(frame, "invite-code");
  return { code: f.code, expiresAt: f.expiresAt };
}

function nextFrame<T extends ServerFrame["type"]>(
  deps: ShareDeps,
  type: T,
  projectId: string,
): { frame: Promise<Extract<ServerFrame, { type: T }>>; cancel(): void } {
  const wanted = (f: ServerFrame): f is Extract<ServerFrame, { type: T }> =>
    f.type === type && "projectId" in f && f.projectId === projectId;
  let cancel = () => undefined;
  const frame = new Promise<Extract<ServerFrame, { type: T }>>((resolve, reject) => {
    const off = deps.client.onFrame((f) => {
      if (!wanted(f)) return;
      cancel();
      resolve(f);
    });
    const timer = setTimeout(() => {
      cancel();
      reject(new KiboError("SYNC_OFFLINE", `no ${type} received for project ${projectId}`));
    }, timeoutOf(deps));
    cancel = () => {
      off();
      clearTimeout(timer);
    };
  });
  return { frame, cancel: () => cancel() };
}

function assertJoinable(deps: ShareDeps, projectId: string, doc: LoroDoc): void {
  const meta = getProjectMeta(doc);
  if (meta.id !== projectId) {
    throw new KiboError("INVALID_INPUT", `sync data for ${projectId} describes project ${meta.id}`);
  }
  if (deps.hosts.projectIds().includes(projectId)) {
    throw new KiboError("INVALID_INPUT", `project ${projectId} is already on this machine`);
  }
  const keys = deps.hosts.projectIds().map((id) => getProjectMeta(deps.hosts.host(id).doc()).key);
  if (keys.includes(meta.key)) throw new KiboError("INVALID_INPUT", `duplicate project key ${meta.key}`);
}

export async function joinProject(
  deps: ShareDeps,
  input: { code: string; folder: string | null },
): Promise<ProjectMeta> {
  requireOnline(deps);
  const code = normalizeCode(input.code);
  const joined = await deps.client.request({ type: "redeem", requestId: rid(), code }, "joined");
  try {
    return await adoptJoined(deps, joined, input.folder);
  } catch (e) {
    throw joinRefusal(e);
  }
}

async function adoptJoined(
  deps: ShareDeps,
  joined: Extract<ServerFrame, { type: "joined" }>,
  folder: string | null,
): Promise<ProjectMeta> {
  const received = nextFrame(deps, "update", joined.projectId);
  let update: Extract<ServerFrame, { type: "update" }>;
  try {
    deps.client.send({ type: "subscribe", projectId: joined.projectId, version: null });
    update = await received.frame;
  } finally {
    received.cancel();
    deps.client.send({ type: "unsubscribe", projectId: joined.projectId });
  }
  const doc = docFromServer(joined.projectId, fromBase64(update.bytes));
  assertJoinable(deps, joined.projectId, doc);
  const meta = deps.hosts.addJoinedProject(doc, folder);
  if (folder !== null) deps.settings.set(meta.id, LOCAL_FOLDER_KEY, folder);
  deps.db.upsertProject({
    projectId: meta.id,
    enabled: true,
    role: joined.role,
    lastServerVersion: fromBase64(update.version),
    lastSyncAt: null,
    lastError: null,
    accessRevoked: false,
  });
  deps.client.attachProject(meta.id, joined.role);
  return meta;
}

export async function setMemberRole(
  deps: ShareDeps,
  input: { projectId: string; userId: string; role: MemberRole | null },
): Promise<MemberInfo[]> {
  requireOnline(deps);
  requireOwner(deps, input.projectId);
  const members = nextFrame(deps, "members", input.projectId);
  try {
    await deps.client.request({ type: "set-role", requestId: rid(), ...input }, "done");
  } catch (e) {
    members.cancel();
    throw e;
  }
  return (await members.frame).members;
}

export async function unshareProject(deps: ShareDeps, projectId: string): Promise<void> {
  const { userId } = requireOnline(deps);
  requireOwner(deps, projectId);
  await deps.client.request({ type: "unshare", projectId, requestId: rid() }, "done");
  deps.client.detachProject(projectId);
  deps.hosts.mutate(projectId, (doc) => {
    restoreLocalAllocation(doc);
    migrateForUnsharing(doc, { localUser: deps.hosts.localUser(), userId });
    doc.getMap("meta").delete("members");
  });
}

export function setBindingRunner(deps: ShareDeps, input: { projectId: string; bindingId: string }): void {
  const config = deps.db.config();
  if (!config) throw new KiboError("INVALID_INPUT", "no sync server is configured");
  const row = deps.db.project(input.projectId);
  if (!row || row.accessRevoked)
    throw new KiboError("INVALID_INPUT", `project ${input.projectId} is not shared`);
  const binding = getBinding(deps.hosts.host(input.projectId).doc(), input.bindingId);
  if (row.role !== "owner" && binding.createdBy !== config.userId) {
    throw new KiboError("FORBIDDEN", "only the binding owner or a project owner can change its runner");
  }
  deps.hosts.mutate(input.projectId, (doc) => {
    doc.getMap("bindings").set(input.bindingId, { ...binding, runner: config.userId });
  });
}
