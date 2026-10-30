import { z } from "zod";
import type { ProjectMeta } from "./project";
import { type MemberInfo, MemberRole, type ProjectSyncInfo } from "./sharing";
import { type DeviceInfo, type PresencePeer, SyncId, type SyncStatus } from "./sync";

const id = SyncId;

export const SYNC_RPC_REQUESTS = [
  z.object({ method: z.literal("getSyncStatus") }),
  z.object({
    method: z.literal("connectSyncServer"),
    serverUrl: z.string().min(1).max(2048),
    code: z.string().min(1).max(64),
    deviceName: z.string().trim().min(1).max(64),
    caFile: z.string().min(1).nullable(),
  }),
  z.object({ method: z.literal("disconnectSyncServer") }),
  z.object({ method: z.literal("listDevices") }),
  z.object({ method: z.literal("addDevice") }),
  z.object({ method: z.literal("revokeDevice"), deviceId: id }),
  z.object({ method: z.literal("shareProject"), projectId: id }),
  z.object({ method: z.literal("createProjectInvite"), projectId: id, role: z.enum(["editor", "viewer"]) }),
  z.object({
    method: z.literal("joinProject"),
    code: z.string().min(1).max(64),
    folder: z.string().min(1).nullable(),
  }),
  z.object({ method: z.literal("setMemberRole"), projectId: id, userId: id, role: MemberRole.nullable() }),
  z.object({ method: z.literal("unshareProject"), projectId: id }),
  z.object({ method: z.literal("setBindingRunner"), projectId: id, bindingId: id }),
  z.object({
    method: z.literal("setPresence"),
    projectId: id,
    pageId: id.nullable(),
    ticketId: id.nullable(),
  }),
  z.object({ method: z.literal("getPresence"), projectId: id }),
] as const;

export type SyncRpcRequest = z.infer<(typeof SYNC_RPC_REQUESTS)[number]>;
export const SYNC_RPC_METHODS: ReadonlySet<string> = new Set(
  SYNC_RPC_REQUESTS.map((s) => s.shape.method.value),
);

export type SyncRpcResult = {
  getSyncStatus: SyncStatus;
  connectSyncServer: SyncStatus;
  disconnectSyncServer: null;
  listDevices: DeviceInfo[];
  addDevice: { code: string; expiresAt: number };
  revokeDevice: null;
  shareProject: ProjectSyncInfo;
  createProjectInvite: { code: string; expiresAt: number };
  joinProject: ProjectMeta;
  setMemberRole: MemberInfo[];
  unshareProject: null;
  setBindingRunner: null;
  setPresence: null;
  getPresence: PresencePeer[];
};
