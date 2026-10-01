import { KiboError, type RpcRequest } from "@kibo/schema";
import { assertNotInbox } from "../inbox/inbox-rules";
import { type RpcContext, type RpcOutcome, requireLocal } from "../rpc-extensions";
import type { PresenceHub } from "./presence";
import {
  createProjectInvite,
  joinProject,
  type ShareDeps,
  setBindingRunner,
  setMemberRole,
  shareProject,
  unshareProject,
} from "./share";
import type { SyncClient } from "./sync-client";

export type SyncRpcClient = Pick<
  SyncClient,
  "status" | "connect" | "disconnect" | "listDevices" | "addDevice" | "revokeDevice"
>;

const need = (share: ShareDeps | undefined): ShareDeps => {
  if (!share) throw new KiboError("INTERNAL", "sharing is not wired");
  return share;
};

const needPresence = (presence: PresenceHub | undefined): PresenceHub => {
  if (!presence) throw new KiboError("INTERNAL", "presence is not wired");
  return presence;
};

export async function handleSyncRpc(
  client: SyncRpcClient,
  req: RpcRequest,
  ctx: RpcContext,
  share?: ShareDeps,
  presence?: PresenceHub,
): Promise<RpcOutcome> {
  switch (req.method) {
    case "getSyncStatus":
      return { handled: true, result: client.status() };
    case "connectSyncServer": {
      requireLocal(ctx);
      const { serverUrl, code, deviceName, caFile } = req;
      return { handled: true, result: await client.connect({ serverUrl, code, deviceName, caFile }) };
    }
    case "disconnectSyncServer":
      requireLocal(ctx);
      await client.disconnect();
      return { handled: true, result: null };
    case "listDevices":
      return { handled: true, result: await client.listDevices() };
    case "addDevice":
      requireLocal(ctx);
      return { handled: true, result: await client.addDevice() };
    case "revokeDevice":
      requireLocal(ctx);
      await client.revokeDevice(req.deviceId);
      return { handled: true, result: null };
    case "shareProject":
      assertNotInbox(req.projectId, "sharing");
      return { handled: true, result: await shareProject(need(share), req.projectId) };
    case "createProjectInvite":
      assertNotInbox(req.projectId, "sharing");
      return { handled: true, result: await createProjectInvite(need(share), req) };
    case "joinProject":
      return { handled: true, result: await joinProject(need(share), req) };
    case "setMemberRole":
      return { handled: true, result: await setMemberRole(need(share), req) };
    case "unshareProject":
      await unshareProject(need(share), req.projectId);
      return { handled: true, result: null };
    case "setBindingRunner":
      setBindingRunner(need(share), req);
      return { handled: true, result: null };
    case "setPresence":
      needPresence(presence).set(req.projectId, { pageId: req.pageId, ticketId: req.ticketId });
      return { handled: true, result: null };
    case "getPresence":
      return { handled: true, result: needPresence(presence).peers(req.projectId) };
    default:
      return { handled: false };
  }
}
