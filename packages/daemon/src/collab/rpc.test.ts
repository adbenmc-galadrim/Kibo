import { expect, test } from "bun:test";
import type { SyncStatus } from "@kibo/schema";
import { handleSyncRpc, type SyncRpcClient } from "./rpc";

const status: SyncStatus = {
  state: "unconfigured",
  serverUrl: null,
  user: null,
  deviceId: null,
  retryAt: null,
  lastError: null,
  projects: [],
};

function fakeClient(calls: string[]): SyncRpcClient {
  return {
    status: () => status,
    connect: async (input) => {
      calls.push(`connect ${input.serverUrl} ${input.deviceName}`);
      return status;
    },
    disconnect: async () => {
      calls.push("disconnect");
    },
    listDevices: async () => [],
    addDevice: async () => ({ code: "C", expiresAt: 1 }),
    revokeDevice: async (deviceId) => {
      calls.push(`revoke ${deviceId}`);
    },
  };
}

const local = { sessionHash: "h", remote: false };
const remote = { sessionHash: "h", remote: true };
const connect = {
  method: "connectSyncServer",
  serverUrl: "wss://sync.kibo.test",
  code: "CODE",
  deviceName: "Adam",
  caFile: null,
} as const;

test("connecting, disconnecting and managing devices are refused from a remote session", async () => {
  const calls: string[] = [];
  const client = fakeClient(calls);
  const localOnly = [
    connect,
    { method: "disconnectSyncServer" },
    { method: "addDevice" },
    { method: "revokeDevice", deviceId: "d2" },
  ] as const;
  for (const req of localOnly) {
    await expect(handleSyncRpc(client, req, remote)).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
  expect(calls).toEqual([]);
  expect(await handleSyncRpc(client, { method: "listDevices" }, remote)).toEqual({
    handled: true,
    result: [],
  });
});

test("sync methods reach the client, others are left to the next handler", async () => {
  const calls: string[] = [];
  const client = fakeClient(calls);
  expect(await handleSyncRpc(client, { method: "getSyncStatus" }, remote)).toEqual({
    handled: true,
    result: status,
  });
  expect(await handleSyncRpc(client, connect, local)).toEqual({ handled: true, result: status });
  expect(await handleSyncRpc(client, { method: "revokeDevice", deviceId: "d2" }, local)).toEqual({
    handled: true,
    result: null,
  });
  expect(await handleSyncRpc(client, { method: "addDevice" }, local)).toEqual({
    handled: true,
    result: { code: "C", expiresAt: 1 },
  });
  expect(await handleSyncRpc(client, { method: "disconnectSyncServer" }, local)).toEqual({
    handled: true,
    result: null,
  });
  expect(await handleSyncRpc(client, { method: "listProjects" }, local)).toEqual({ handled: false });
  expect(calls).toEqual(["connect wss://sync.kibo.test Adam", "revoke d2", "disconnect"]);
});
