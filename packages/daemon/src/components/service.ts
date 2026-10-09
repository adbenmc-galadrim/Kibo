import type { Database } from "bun:sqlite";
import { listProjects, readProject } from "@kibo/core";
import { type BuildOutput, type Toolchain, validateComponent } from "@kibo/devkit";
import {
  type DeliveryResult,
  type Instance,
  KiboError,
  type PresencePeer,
  type ProjectSyncInfo,
  type TicketRun,
  type ValidationReport,
} from "@kibo/schema";
import type { CommandHub } from "../command-path";
import type { Docs } from "../docs";
import { createFilesService, type FilesService } from "../files/service";
import type { ComponentIntegrationHooks } from "../integrations/types";
import { ensureNotesTables } from "../notes/index";
import { createNotesService } from "../notes/service";
import { ensureSettingsTable } from "../notes/settings";
import { createBackends } from "./backends";
import { approvedHashOf, stampComponentHash } from "./component-hash";
import { listDrafts } from "./drafts";
import { createEventLog, type EventLog, ensureEventsTable } from "./events";
import { createGate } from "./gate";
import { createGateHandlers } from "./gate-handlers";
import { createInflight } from "./inflight";
import { createJobScheduler, type JobSchedulerDeps } from "./jobs";
import type { ComponentRequest } from "./methods";
import type { NetProxyOptions } from "./net-proxy";
import { createPublisher, type Publisher } from "./publish";
import { createPublishLock, type PublishLock } from "./publish-lock";
import { createQuotas } from "./quotas";
import { createRegistryService, type RegistryService } from "./registry-service";
import type { AssetLookup } from "./sandbox-server";
import { type ComponentStore, createComponentStore } from "./store";
import { updateInstance } from "./update";
import { createUsageTracker, jobTargets } from "./usage";

export type ComponentsDeps = {
  home: string;
  toolchain: Toolchain;
  db: Database;
  docs: Docs;
  commands: Pick<CommandHub, "intercept">;
  sandboxOrigin(): string;
  runs(projectId: string): TicketRun[];
  build?: (srcDir: string, t: Toolchain) => Promise<BuildOutput>;
  validate?: (dir: string, signal: AbortSignal) => Promise<ValidationReport>;
  processCommand?: string[];
  allowUnsandboxed?: () => boolean;
  net?: NetProxyOptions;
  integrations?: () => ComponentIntegrationHooks | null;
  presence?: (projectId: string) => PresencePeer[];
  sharing?: (projectId: string) => ProjectSyncInfo;
  deliverAnswers?: (projectId: string, ticketId: string) => DeliveryResult;
  installCli?: () => Promise<{ path: string }>;
  cliStatus?: () => Promise<{ path: string; installed: boolean }>;
  jobTimers?: Pick<JobSchedulerDeps, "setInterval" | "clearInterval">;
  drainMs?: number;
};
export type ComponentsService = {
  handle(req: ComponentRequest): Promise<unknown>;
  assets: AssetLookup;
  registry: RegistryService;
  store: ComponentStore;
  publisher: Publisher;
  publishLock: PublishLock;
  events: EventLog;
  files: FilesService;
  notesDir(projectId: string): string;
  usageChanged(): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  afterCommand(projectId: string): void;
};

const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what}`, e);
const DEFAULT_DRAIN_MS = 5_000;

export function createComponentsService(deps: ComponentsDeps): ComponentsService {
  const { docs } = deps;
  const shutdown = new AbortController();
  const inflight = createInflight();
  const publishLock = createPublishLock();
  let stopped: Promise<void> | null = null;
  let offStamp: (() => void) | null = null;
  ensureEventsTable(deps.db);
  ensureSettingsTable(deps.db);
  ensureNotesTables(deps.db);
  const events = createEventLog(deps.db);
  const store = createComponentStore({
    home: deps.home,
    toolchain: deps.toolchain,
    ...(deps.build && { build: deps.build }),
  });
  const projects = () =>
    listProjects(docs.workspace).map((m) => ({ id: m.id, name: m.name, doc: docs.project(m.id) }));
  const instanceOf = (projectId: string, instanceId: string): Instance => {
    const inst = readProject(docs.project(projectId)).instances.find((i) => i.id === instanceId);
    if (!inst) throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
    return inst;
  };
  const workspaceChanged = () => docs.emit({ projectId: null });

  const notes = createNotesService({
    db: deps.db,
    home: deps.home,
    project: (id) => {
      const meta = docs.projectMeta(id);
      return { id: meta.id, key: meta.key, folder: meta.folder };
    },
    onChange: (id) => docs.emit({ projectId: id }),
  });

  const files = createFilesService({
    db: deps.db,
    home: deps.home,
    project: (id) => docs.projectMeta(id),
    sandboxOrigin: deps.sandboxOrigin,
  });

  const registry = createRegistryService({
    workspace: docs.workspace,
    persistWorkspace: () => docs.save(null),
    projects,
    store,
    events,
    stopBackend: (ref) => usage.stop(ref),
    emit: workspaceChanged,
    onApproved: async (id, v) => {
      await publisher.applyUpdateAll(id, v.version);
    },
  });

  const gate = createGate({
    instance: instanceOf,
    active: (ref) => registry.active(ref),
    quotas: createQuotas(),
    events,
    handlers: createGateHandlers({
      docs,
      notes,
      files,
      backends: () => backends,
      runs: deps.runs,
      manifestOf: (ref) => registry.manifestOf(ref),
      ...(deps.net && { net: deps.net }),
      ...(deps.integrations && { integrations: deps.integrations }),
      ...(deps.presence && { presence: deps.presence }),
      ...(deps.sharing && { sharing: deps.sharing }),
      ...(deps.deliverAnswers && { deliverAnswers: deps.deliverAnswers }),
    }),
  });

  const backends = createBackends({
    source: (ref) => registry.source(ref),
    verify: (ref) => inflight.track(registry.verify(ref)),
    onCall: (projectId, instanceId, call) => inflight.track(gate.call(projectId, instanceId, call)),
    ...(deps.processCommand && { processCommand: deps.processCommand }),
    ...(deps.allowUnsandboxed && { allowUnsandboxed: deps.allowUnsandboxed }),
  });

  const usage = createUsageTracker({ projects, backends });

  const jobs = createJobScheduler({
    targets: () => jobTargets(projects(), (ref) => registry.source(ref) !== null),
    describe: (ref) => usage.describe(ref),
    run: (t, job) =>
      backends.runJob(t.ref, { projectId: t.projectId, instanceId: t.instanceId, config: t.config, job }),
    ...deps.jobTimers,
  });
  const usageChanged = () => {
    usage.prune();
    jobs.refresh().catch(log("jobs refresh failed"));
  };
  const offRemoved = docs.onProjectRemoved((projectId) => {
    notes.forget(projectId);
    usageChanged();
  });

  const update = async (projectId: string, instanceId: string, to: string) => {
    docs.assertWritable(projectId);
    const inst = await updateInstance(
      {
        doc: (id) => docs.project(id),
        assertWritable: (id) => docs.assertWritable(id),
        persist: (id) => docs.save(id),
        manifestOf: (ref) => registry.manifestOf(ref),
        migrate: (ref, req) => backends.migrate(ref, req),
        approvedHash: (ref) => approvedHashOf(docs.workspace, ref),
      },
      projectId,
      instanceId,
      to,
    );
    docs.emit({ projectId });
    usageChanged();
    return inst;
  };

  const publisher = createPublisher({
    home: deps.home,
    workspace: docs.workspace,
    persistWorkspace: () => docs.save(null),
    emit: workspaceChanged,
    store,
    registry,
    validate:
      deps.validate ?? ((dir, signal) => validateComponent(dir, { toolchain: deps.toolchain, signal })),
    signal: shutdown.signal,
    update,
  });

  const assets: AssetLookup = (id, version, hash) => {
    const ref = `${id}@${version}`;
    const stored = registry.stored(ref);
    if (!stored || stored.hash !== hash) return null;
    const active = registry.active(ref);
    return { stored, trust: active.trust, capabilities: active.granted.capabilities };
  };

  const reportRefusal = (projectId: string, instanceId: string, kind: "navigate" | "focus") => {
    const inst = instanceOf(projectId, instanceId);
    events.record({ projectId, instanceId, ref: inst.component, kind, code: "PERMISSION_DENIED" });
    return null;
  };

  const dispatch = async (req: ComponentRequest): Promise<unknown> => {
    switch (req.method) {
      case "listComponents":
        return registry.list();
      case "componentCall":
        return gate.call(req.projectId, req.instanceId, req.call);
      case "approveComponent": {
        const v = await registry.approve(req.id, req.version, req.hash, req.trust);
        usageChanged();
        return v;
      }
      case "revokeComponent":
        registry.revoke(req.id, req.version);
        usageChanged();
        return null;
      case "rehashComponent":
        return registry.rehash(req.id, req.version);
      case "previewPublish":
        return publisher.preview(req.id);
      case "publishComponent": {
        const r = await publishLock.hold(req.id, () => publisher.publish(req.id, req.strategy));
        usageChanged();
        return r;
      }
      case "updateInstance":
        return update(req.projectId, req.instanceId, req.to);
      case "uninstallComponent":
        await registry.uninstall(req.id, req.version);
        return null;
      case "listDrafts":
        return listDrafts(deps.home, docs.workspace);
      case "getNotesDir":
        return notes.info(req.projectId);
      case "setNotesDir":
        return notes.setDir(req.projectId, req.dir);
      case "getRuntimeInfo":
        return { sandboxOrigin: deps.sandboxOrigin() };
      case "installCli":
        if (!deps.installCli)
          throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
        return deps.installCli();
      case "cliStatus":
        if (!deps.cliStatus)
          throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
        return deps.cliStatus();
      case "reportComponentRefusal":
        return reportRefusal(req.projectId, req.instanceId, req.kind);
      case "listAssets":
        return files.list(req.projectId);
      case "beginAssetUpload":
        return files.uploads.begin(req.projectId, req.name, req.mime, req.size);
      case "appendAssetUpload":
        return files.uploads.append(req.uploadId, req.index, Buffer.from(req.bytes, "base64"));
      case "finishAssetUpload":
        return files.uploads.finish(req.uploadId);
      case "cancelAssetUpload":
        await files.uploads.cancel(req.uploadId);
        return null;
      case "removeAsset":
        await files.remove(req.projectId, req.name);
        return null;
      case "getFilesDir":
        return files.info(req.projectId);
      case "setFilesDir":
        return files.setDir(req.projectId, req.dir);
    }
  };

  const handle = (req: ComponentRequest): Promise<unknown> => {
    if (stopped) return Promise.reject(new KiboError("INTERNAL", "the daemon is stopping"));
    return inflight.track(dispatch(req));
  };

  const stopAll = async () => {
    offStamp?.();
    offRemoved();
    jobs.stop();
    backends.stopAll();
    shutdown.abort();
    await inflight.drain(deps.drainMs ?? DEFAULT_DRAIN_MS);
    await files.close();
    notes.close();
    events.flush();
  };

  return {
    handle,
    assets,
    registry,
    store,
    publisher,
    publishLock,
    events,
    files,
    notesDir: (projectId) => notes.info(projectId).dir,
    usageChanged,
    afterCommand: () => usageChanged(),
    async start() {
      offStamp = deps.commands.intercept(stampComponentHash(docs.workspace));
      await registry.verifyAll();
      for (const id of docs.projectIds()) await notes.refresh(id).catch(log(`notes scan failed for ${id}`));
      usageChanged();
    },
    stop() {
      stopped ??= stopAll();
      return stopped;
    },
  };
}
