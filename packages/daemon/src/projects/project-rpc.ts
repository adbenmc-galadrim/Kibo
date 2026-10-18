import {
  assertShellCommand,
  countTicketsByStatus,
  createProjectDoc,
  executeProjectCommand,
  getKeyAllocator,
  getProjectMeta,
  listInstances,
  listProjects,
  readProject,
  registerProject,
  setProjectMeta,
} from "@kibo/core";
import {
  iconOwnerKey,
  isInbox,
  KiboError,
  type ProjectMeta,
  ProjectSetup,
  type ProjectSyncInfo,
  type RpcRequest,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { isDemoProject } from "../demo/demo-project";
import type { Docs } from "../docs";
import type { IconStore } from "../icons/icon-store";
import type { createFileTicket } from "../inbox/file-ticket";
import { assertProjectKeyAllowed } from "../inbox/inbox-rules";
import { markMigrated } from "../migrations/tracking";
import type { ProjectSettings } from "../notes/settings";
import {
  localDelivery,
  localDuplication,
  localFolder,
  localStorybook,
  localWorktree,
} from "../project-folder";
import { setupProject } from "./project-setup";

export type CollabPort = { syncInfo(projectId: string, doc: LoroDoc): ProjectSyncInfo };
export type ProjectRpcDeps = {
  workspace: LoroDoc;
  docs: Docs;
  icons: Pick<IconStore, "version">;
  settings: Pick<ProjectSettings, "get" | "set">;
  collab(): CollabPort | null;
  adopt(id: string, doc: LoroDoc): void;
  fileTicket: ReturnType<typeof createFileTicket>;
};

export const NOT_HANDLED: unique symbol = Symbol("not handled");

const folderOf = (deps: ProjectRpcDeps, meta: ProjectMeta): string | null =>
  localFolder(deps.settings, meta, getKeyAllocator(deps.docs.project(meta.id)) === "server");

function parsedSetup(setup: unknown): ProjectSetup | null {
  if (setup === undefined) return null;
  const parsed = ProjectSetup.safeParse(setup);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid project setup: ${parsed.error.message}`);
  return parsed.data;
}

function newProjectDoc(meta: ProjectMeta, client: string | null, setup: ProjectSetup | null): LoroDoc {
  const doc = createProjectDoc(meta);
  if (client) setProjectMeta(doc, { client });
  if (setup) setupProject((command) => executeProjectCommand(doc, command), setup);
  return doc;
}

const projectIcon = (projectId: string) => iconOwnerKey({ kind: "project", projectId });

function createProject(
  deps: ProjectRpcDeps,
  req: Extract<RpcRequest, { method: "createProject" }>,
): ProjectMeta {
  assertProjectKeyAllowed(req.key);
  const setup = parsedSetup(req.setup);
  const meta: ProjectMeta = {
    id: crypto.randomUUID(),
    key: req.key,
    name: req.name,
    folder: req.folder,
    color: req.color,
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  };
  const doc = newProjectDoc(meta, req.client ?? null, setup);
  registerProject(deps.workspace, meta);
  deps.adopt(meta.id, doc);
  if (setup) markMigrated(deps.settings, meta.id, deps.docs.today());
  deps.docs.save(meta.id);
  deps.docs.save(null);
  deps.docs.emit({ projectId: null });
  return { ...meta, client: getProjectMeta(doc).client };
}

function getProject(deps: ProjectRpcDeps, projectId: string) {
  const doc = deps.docs.project(projectId);
  const snapshot = {
    ...readProject(doc, deps.docs.today(), deps.docs.activity(projectId)),
    meta: deps.docs.projectMeta(projectId),
    viewer: deps.docs.identity(projectId),
    icon: deps.icons.version(projectIcon(projectId)),
  };
  const collab = deps.collab();
  return collab ? { ...snapshot, sync: collab.syncInfo(projectId, doc) } : snapshot;
}

function runCommand(deps: ProjectRpcDeps, req: Extract<RpcRequest, { method: "command" }>): unknown {
  assertShellCommand(req.command);
  const instanceId = req.instanceId ?? null;
  if (instanceId !== null && isInbox(req.projectId))
    throw new KiboError("INVALID_INPUT", "the inbox has no component instances");
  if (
    instanceId !== null &&
    !listInstances(deps.docs.project(req.projectId)).some((i) => i.id === instanceId)
  )
    throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
  return deps.docs.run(req.projectId, req.command, { origin: "user", instanceId });
}

export function handleProjectRequest(deps: ProjectRpcDeps, req: RpcRequest): unknown {
  switch (req.method) {
    case "listProjects":
      return listProjects(deps.workspace).map((meta) => ({
        ...meta,
        client: getProjectMeta(deps.docs.project(meta.id)).client,
        folder: folderOf(deps, meta),
        worktree: localWorktree(deps.settings, meta.id),
        storybook: localStorybook(deps.settings, meta.id),
        duplication: localDuplication(deps.settings, meta.id),
        delivery: localDelivery(deps.settings, meta.id),
        counts: countTicketsByStatus(deps.docs.project(meta.id)),
        icon: deps.icons.version(projectIcon(meta.id)),
        demo: isDemoProject(deps.settings, meta.id),
      }));
    case "createProject":
      return createProject(deps, req);
    case "getProject":
      return getProject(deps, req.projectId);
    case "command":
      return runCommand(deps, req);
    case "fileTicket":
      return deps.fileTicket(req);
    default:
      return NOT_HANDLED;
  }
}
