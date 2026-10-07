import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  iconOwnerKey,
  KiboError,
  type ProjectMeta,
  ProjectPatch,
  type ProjectSyncInfo,
  type RpcRequest,
  type WorktreeSettings,
} from "@kibo/schema";
import { assertWorktreeSettings } from "../agents/worktree-prep";
import type { Docs } from "../docs";
import { decodeIcon } from "../icons/decode-icon";
import type { IconStore } from "../icons/icon-store";
import { assertNotInbox } from "../inbox/inbox-rules";
import type { ProjectSettings } from "../notes/settings";
import { LOCAL_FOLDER_KEY } from "../project-folder";
import { type RpcContext, type RpcHandler, requireLocal } from "../rpc-extensions";
import type { Store } from "../store";

export type ProjectAdminDeps = {
  docs: Docs;
  settings: ProjectSettings;
  icons: IconStore;
  store: Pick<Store, "transaction">;
  sharing(projectId: string): ProjectSyncInfo;
  activeRuns(projectId: string): number;
  detach(projectId: string): void;
  isLocked(projectId: string): boolean;
  folderExists?(path: string): boolean;
  prepareDelete?(projectId: string): (() => void) | null;
};
type UpdateRequest = Extract<RpcRequest, { method: "updateProject" }>;
type IconRequest = Extract<RpcRequest, { method: "setIcon" }>;
type DeleteRequest = Extract<RpcRequest, { method: "deleteProject" }>;
export type ProjectAdmin = {
  updateProject(req: UpdateRequest, ctx: RpcContext): ProjectMeta;
  setIcon(req: IconRequest): { icon: string | null };
  deleteProject(req: DeleteRequest, ctx: RpcContext): null;
  handler: RpcHandler;
};

export function folderIsDirectory(path: string): boolean {
  if (!isAbsolute(path)) return false;
  try {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
  } catch {
    return false;
  }
}

const keepsFolderOutOfDoc = (info: ProjectSyncInfo): boolean => info.shared || info.keyAllocator === "server";
const ownsActiveShare = (info: ProjectSyncInfo): boolean =>
  info.shared && info.role === "owner" && info.access !== "revoked";

function parsePatch(patch: unknown): ProjectPatch {
  const parsed = ProjectPatch.safeParse(patch);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid project patch: ${parsed.error.message}`);
  return parsed.data;
}

export function createProjectAdmin(deps: ProjectAdminDeps): ProjectAdmin {
  const folderExists = deps.folderExists ?? folderIsDirectory;

  const refuseActiveRuns = (projectId: string) => {
    if (deps.activeRuns(projectId) > 0) {
      throw new KiboError("CONFLICT", `project ${projectId} has active runs`);
    }
  };

  const checkFolder = (projectId: string, folder: string | null, ctx: RpcContext) => {
    requireLocal(ctx);
    if (folder !== null && !folderExists(folder)) {
      throw new KiboError("INVALID_INPUT", `${folder} is not an existing folder`);
    }
    refuseActiveRuns(projectId);
  };

  const checkWorktree = (worktree: WorktreeSettings | null, ctx: RpcContext) => {
    requireLocal(ctx);
    if (worktree !== null) assertWorktreeSettings(worktree);
  };

  const storeLocalFolder = (projectId: string, folder: string | null) => {
    if (folder === null) deps.settings.unset(projectId, LOCAL_FOLDER_KEY);
    else deps.settings.set(projectId, LOCAL_FOLDER_KEY, folder);
  };

  const admin: ProjectAdmin = {
    updateProject(req, ctx) {
      const { projectId } = req;
      assertNotInbox(projectId, "updating a project");
      deps.docs.project(projectId);
      const patch = parsePatch(req.patch);
      if (patch.folder !== undefined) checkFolder(projectId, patch.folder, ctx);
      if (patch.worktree !== undefined) checkWorktree(patch.worktree, ctx);
      const outOfDoc = keepsFolderOutOfDoc(deps.sharing(projectId));
      const touchesDoc = patch.name !== undefined || patch.color !== undefined;
      if (touchesDoc || (patch.folder !== undefined && !outOfDoc)) deps.docs.assertWritable(projectId);
      return deps.store.transaction(() => {
        const folder = patch.folder;
        if (folder !== undefined) {
          if (outOfDoc) storeLocalFolder(projectId, folder);
          else deps.settings.unset(projectId, LOCAL_FOLDER_KEY);
        }
        return deps.docs.updateProjectMeta(projectId, patch, !outOfDoc);
      });
    },
    setIcon(req) {
      const owner = req.owner;
      if (owner.kind === "project") {
        assertNotInbox(owner.projectId, "an icon");
        deps.docs.project(owner.projectId);
      }
      const key = iconOwnerKey(owner);
      let icon: string | null = null;
      if (req.icon === null) deps.icons.remove(key);
      else {
        const decoded = decodeIcon(req.icon);
        icon = deps.icons.set(key, decoded.mime, decoded.bytes);
      }
      if (owner.kind === "project") {
        deps.docs.emit({ projectId: owner.projectId });
        deps.docs.emit({ projectId: null });
      } else deps.docs.emit({ topic: "config" });
      return { icon };
    },
    deleteProject(req, ctx) {
      requireLocal(ctx);
      const { projectId } = req;
      assertNotInbox(projectId, "deleting a project");
      deps.docs.project(projectId);
      refuseActiveRuns(projectId);
      if (deps.isLocked(projectId)) throw new KiboError("CONFLICT", `project ${projectId} is being shared`);
      const sync = deps.sharing(projectId);
      if (ownsActiveShare(sync)) {
        throw new KiboError("CONFLICT", `project ${projectId} is shared: stop sharing first`);
      }
      const afterDelete = deps.prepareDelete?.(projectId) ?? null;
      deps.store.transaction(() => {
        deps.icons.remove(iconOwnerKey({ kind: "project", projectId }));
        deps.settings.remove(projectId);
        if (sync.shared) deps.detach(projectId);
        deps.docs.removeProject(projectId);
      });
      afterDelete?.();
      return null;
    },
    handler: async (req, ctx) => {
      switch (req.method) {
        case "updateProject":
          return { handled: true, result: admin.updateProject(req, ctx) };
        case "setIcon":
          return { handled: true, result: admin.setIcon(req) };
        case "deleteProject":
          return { handled: true, result: admin.deleteProject(req, ctx) };
        default:
          return { handled: false };
      }
    },
  };
  return admin;
}
