import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";

test("phase 7 sync, presence and security RPCs parse", () => {
  const requests = [
    { method: "listSessions" },
    { method: "revokeSession", id: "a".repeat(64) },
    { method: "getRemoteAccess" },
    { method: "enableRemoteAccess", address: "192.168.1.20", port: 47832, tls: { kind: "self-signed" } },
    { method: "disableRemoteAccess" },
    { method: "createPairingCode" },
    { method: "getSandboxStatus" },
    { method: "setAllowUnsandboxed", allow: true },
    { method: "getSyncStatus" },
    {
      method: "connectSyncServer",
      serverUrl: "wss://sync.kibo.test",
      code: "ABCD",
      deviceName: "Mac",
      caFile: null,
    },
    { method: "disconnectSyncServer" },
    { method: "listDevices" },
    { method: "addDevice" },
    { method: "revokeDevice", deviceId: "d2" },
    { method: "shareProject", projectId: "p1" },
    { method: "createProjectInvite", projectId: "p1", role: "viewer" },
    { method: "joinProject", code: "ABCD", folder: null },
    { method: "setMemberRole", projectId: "p1", userId: "u2", role: null },
    { method: "unshareProject", projectId: "p1" },
    { method: "setBindingRunner", projectId: "p1", bindingId: "b1" },
    { method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: null },
    { method: "getPresence", projectId: "p1" },
  ];
  for (const r of requests) expect(RpcRequest.safeParse(r).success).toBe(true);
});

test("invalid phase 7 RPCs are refused", () => {
  expect(
    RpcRequest.safeParse({
      method: "enableRemoteAccess",
      address: "0.0.0.0",
      port: 47832,
      tls: { kind: "self-signed" },
    }).success,
  ).toBe(false);
  expect(
    RpcRequest.safeParse({ method: "createProjectInvite", projectId: "p1", role: "owner" }).success,
  ).toBe(false);
  expect(
    RpcRequest.safeParse({
      method: "connectSyncServer",
      serverUrl: "",
      code: "A",
      deviceName: "M",
      caFile: null,
    }).success,
  ).toBe(false);
  expect(RpcRequest.safeParse({ method: "setAllowUnsandboxed" }).success).toBe(false);
});
