import type { RpcRequest } from "@kibo/schema";
import { type RpcContext, type RpcOutcome, requireLocal } from "../rpc-extensions";
import type { SyncClient } from "./sync-client";

export type SyncRpcClient = Pick<
  SyncClient,
  "status" | "connect" | "disconnect" | "listDevices" | "addDevice" | "revokeDevice"
>;

export async function handleSyncRpc(
  client: SyncRpcClient,
  req: RpcRequest,
  ctx: RpcContext,
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
    default:
      return { handled: false };
  }
}
