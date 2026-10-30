import type { Database } from "bun:sqlite";
import { getKeyAllocator, getProjectMeta, readProject } from "@kibo/core";
import { type ComponentManifest, type Instance, KiboError, type TicketRun } from "@kibo/schema";
import type { Docs } from "../docs";
import { createFilesService, type FilesService } from "../files/service";
import type { ComponentIntegrationHooks } from "../integrations/types";
import type { NotesService } from "../notes/service";
import { createProjectSettings } from "../notes/settings";
import { localFolder } from "../project-folder";
import { builtinManifestOf } from "./builtin-manifests";
import { createEventLog, type EventLog, ensureEventsTable } from "./events";
import { createGate } from "./gate";
import { createGateHandlers, type GateHandlersDeps } from "./gate-handlers";
import { createInflight } from "./inflight";
import type { ComponentRequest } from "./methods";
import type { NetProxyOptions } from "./net-proxy";
import { createQuotas } from "./quotas";

export type ComponentsDeps = {
  home: string;
  db: Database;
  docs: Docs;
  notes: Pick<NotesService, "info" | "list" | "setDir">;
  sandboxOrigin(): string;
  runs(projectId: string): TicketRun[];
  net?: NetProxyOptions;
  integrations?: () => ComponentIntegrationHooks | null;
  projectEvents?: GateHandlersDeps["projectEvents"];
  installCli?: () => Promise<{ path: string }>;
  cliStatus?: () => Promise<{ path: string; installed: boolean }>;
  drainMs?: number;
};
export type ComponentsService = {
  handle(req: ComponentRequest): Promise<unknown>;
  events: EventLog;
  files: FilesService;
  stop(): Promise<void>;
};

const DEFAULT_DRAIN_MS = 5_000;

async function manifestOf(ref: string): Promise<ComponentManifest> {
  const manifest = builtinManifestOf(ref);
  if (!manifest) throw new KiboError("NOT_FOUND", `${ref} is not a Kibo component`);
  return manifest;
}

export function createComponentsService(deps: ComponentsDeps): ComponentsService {
  const { docs } = deps;
  const inflight = createInflight();
  let stopped: Promise<void> | null = null;
  ensureEventsTable(deps.db);
  const settings = createProjectSettings(deps.db);
  const events = createEventLog(deps.db);
  const instanceOf = (projectId: string, instanceId: string): Instance => {
    const inst = readProject(docs.project(projectId), docs.today()).instances.find(
      (i) => i.id === instanceId,
    );
    if (!inst) throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
    return inst;
  };

  const files = createFilesService({
    db: deps.db,
    home: deps.home,
    project: (id) => docs.projectMeta(id),
    sandboxOrigin: deps.sandboxOrigin,
  });

  const gate = createGate({
    instance: instanceOf,
    quotas: createQuotas(),
    events,
    handlers: createGateHandlers({
      ...deps,
      files,
      manifestOf,
      hasFolder: (projectId) => {
        const doc = deps.docs.project(projectId);
        const local = localFolder(settings, getProjectMeta(doc), getKeyAllocator(doc) === "server");
        return local !== null;
      },
    }),
  });

  const reportRefusal = (projectId: string, instanceId: string, kind: "navigate" | "focus") => {
    const inst = instanceOf(projectId, instanceId);
    events.record({ projectId, instanceId, ref: inst.component, kind, code: "PERMISSION_DENIED" });
    return null;
  };

  const dispatch = async (req: ComponentRequest): Promise<unknown> => {
    switch (req.method) {
      case "componentCall":
        return gate.call(req.projectId, req.instanceId, req.call);
      case "getNotesDir":
        return deps.notes.info(req.projectId);
      case "listNotes":
        return deps.notes.list(req.projectId);
      case "setNotesDir":
        return deps.notes.setDir(req.projectId, req.dir);
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
    await inflight.drain(deps.drainMs ?? DEFAULT_DRAIN_MS);
    await files.close();
    events.flush();
  };

  return {
    handle,
    events,
    files,
    stop() {
      stopped ??= stopAll();
      return stopped;
    },
  };
}
