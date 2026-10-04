import {
  assertShellCommand,
  countTicketsByStatus,
  createProjectDoc,
  getKeyAllocator,
  listInstances,
  listProjectDomains,
  listProjects,
  readProject,
  registerProject,
} from "@kibo/core";
import {
  iconOwnerKey,
  isInbox,
  KiboError,
  type ProjectMeta,
  type ProjectSyncInfo,
  type RpcRequest,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { isDemoProject } from "../demo/demo-project";
import type { Docs } from "../docs";
import type { IconStore } from "../icons/icon-store";
import type { createFileTicket } from "../inbox/file-ticket";
import { assertProjectKeyAllowed } from "../inbox/inbox-rules";
import type { ProjectSettings } from "../notes/settings";

export type CollabPort = { syncInfo(projectId: string, doc: LoroDoc): ProjectSyncInfo };
export type ProjectRpcDeps = {
  workspace: LoroDoc;
  docs: Docs;
  icons: Pick<IconStore, "version">;
  settings: Pick<ProjectSettings, "get">;
  collab(): CollabPort | null;
  adopt(id: string, doc: LoroDoc): void;
  fileTicket: ReturnType<typeof createFileTicket>;
};

export const NOT_HANDLED: unique symbol = Symbol("not handled");

const projectIcon = (projectId: string) => iconOwnerKey({ kind: "project", projectId });

function createProject(
  deps: ProjectRpcDeps,
  req: Extract<RpcRequest, { method: "createProject" }>,
): ProjectMeta {
  assertProjectKeyAllowed(req.key);
  const meta: ProjectMeta = {
    id: crypto.randomUUID(),
    key: req.key,
    name: req.name,
    folder: req.folder,
    color: req.color,
  };
  registerProject(deps.workspace, meta);
  deps.adopt(meta.id, createProjectDoc(meta));
  deps.docs.save(meta.id);
  deps.docs.save(null);
  deps.docs.emit({ projectId: null });
  return meta;
}

function getProject(deps: ProjectRpcDeps, projectId: string) {
  const doc = deps.docs.project(projectId);
  const snapshot = {
    ...readProject(doc),
    meta: deps.docs.projectMeta(projectId),
    viewer: deps.docs.identity(projectId),
    icon: deps.icons.version(projectIcon(projectId)),
    ...(getKeyAllocator(doc) === "server" && { domains: listProjectDomains(doc) }),
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
