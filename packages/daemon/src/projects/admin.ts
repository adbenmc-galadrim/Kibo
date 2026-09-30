import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  iconOwnerKey,
  KiboError,
  type ProjectMeta,
  ProjectPatch,
  type ProjectSyncInfo,
  type RpcRequest,
} from "@kibo/schema";
import type { Docs } from "../docs";
import { decodeIcon } from "../icons/decode-icon";
import type { IconStore } from "../icons/icon-store";
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
  folderExists?(path: string): boolean;
};
type UpdateRequest = Extract<RpcRequest, { method: "updateProject" }>;
type IconRequest = Extract<RpcRequest, { method: "setIcon" }>;
export type ProjectAdmin = {
  updateProject(req: UpdateRequest, ctx: RpcContext): ProjectMeta;
  setIcon(req: IconRequest): { icon: string | null };
  handler: RpcHandler;
};

export const folderIsDirectory = (path: string): boolean =>
  isAbsolute(path) && (statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false);

const keepsFolderOutOfDoc = (info: ProjectSyncInfo): boolean => info.shared || info.keyAllocator === "server";

function parsePatch(patch: unknown): ProjectPatch {
  const parsed = ProjectPatch.safeParse(patch);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid project patch: ${parsed.error.message}`);
  return parsed.data;
}

export function createProjectAdmin(deps: ProjectAdminDeps): ProjectAdmin {
  const folderExists = deps.folderExists ?? folderIsDirectory;

  const checkFolder = (projectId: string, folder: string | null, ctx: RpcContext) => {
    requireLocal(ctx);
    if (folder !== null && !folderExists(folder)) {
      throw new KiboError("INVALID_INPUT", `${folder} is not an existing folder`);
    }
    if (deps.activeRuns(projectId) > 0) {
      throw new KiboError("CONFLICT", `project ${projectId} has active runs`);
    }
  };

  const storeLocalFolder = (projectId: string, folder: string | null) => {
    if (folder === null) deps.settings.unset(projectId, LOCAL_FOLDER_KEY);
    else deps.settings.set(projectId, LOCAL_FOLDER_KEY, folder);
  };

  const admin: ProjectAdmin = {
    updateProject(req, ctx) {
      const { projectId } = req;
      deps.docs.project(projectId);
      const patch = parsePatch(req.patch);
      if (patch.folder !== undefined) checkFolder(projectId, patch.folder, ctx);
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
      if (owner.kind === "project") deps.docs.project(owner.projectId);
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
    handler: async (req, ctx) => {
      switch (req.method) {
        case "updateProject":
          return { handled: true, result: admin.updateProject(req, ctx) };
        case "setIcon":
          return { handled: true, result: admin.setIcon(req) };
        default:
          return { handled: false };
      }
    },
  };
  return admin;
}
