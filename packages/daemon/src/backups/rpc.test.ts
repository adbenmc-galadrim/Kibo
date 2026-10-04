import { expect, test } from "bun:test";
import type { BackupInfo, BackupStatus, RpcRequest } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { backupsRpc } from "./rpc";
import type { BackupsService } from "./service";

const info = (id: string, createdAt: number): BackupInfo => ({
  id,
  createdAt,
  reason: "auto",
  bytes: 1,
  appVersion: "1.5.0",
});
const STATUS: BackupStatus = {
  settings: { enabled: true, dir: null },
  dir: "/h/.kibo/backups",
  displayDir: "~/.kibo/backups",
  last: null,
  nextAt: 0,
  running: false,
};

function fakeService() {
  const calls: string[] = [];
  const service: BackupsService = {
    status: async () => STATUS,
    list: async () => [info("2026-10-01T00-00-00Z", 1), info("2026-10-02T00-00-00Z", 2)],
    create: async (reason) => {
      calls.push(`create:${reason}`);
      return { ...info("2026-10-03T00-00-00Z", 3), reason };
    },
    remove: async (id) => {
      calls.push(`remove:${id}`);
    },
    setSettings: async (patch) => {
      calls.push(`settings:${JSON.stringify(patch)}`);
      return STATUS;
    },
    tick: async () => {},
  };
  return { service, calls };
}

const SETTINGS: RpcRequest = { method: "setBackupSettings", patch: { enabled: false } };
const CREATE: RpcRequest = { method: "createBackup", reason: "manual" };
const DELETE: RpcRequest = { method: "deleteBackup", id: "2026-10-01T00-00-00Z" };
const REQUESTS: RpcRequest[] = [{ method: "getBackups" }, SETTINGS, CREATE, DELETE];

test("every backup method is refused to a remote session", async () => {
  const { service, calls } = fakeService();
  const rpc = backupsRpc(service);
  expect([...rpc.methods].sort()).toEqual(REQUESTS.map((r) => r.method).sort());
  for (const req of REQUESTS)
    await expect(rpc.handle(req, { sessionHash: "s", remote: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  expect(calls).toEqual([]);
});

test("local calls reach the service, backups listed newest first", async () => {
  const { service, calls } = fakeService();
  const rpc = backupsRpc(service);
  expect(await rpc.handle({ method: "getBackups" }, LOCAL_CONTEXT)).toEqual({
    status: STATUS,
    backups: [info("2026-10-02T00-00-00Z", 2), info("2026-10-01T00-00-00Z", 1)],
  });
  expect(await rpc.handle(SETTINGS, LOCAL_CONTEXT)).toEqual(STATUS);
  expect(await rpc.handle(CREATE, LOCAL_CONTEXT)).toMatchObject({ reason: "manual" });
  expect(await rpc.handle(DELETE, LOCAL_CONTEXT)).toBeNull();
  expect(calls).toEqual(['settings:{"enabled":false}', "create:manual", "remove:2026-10-01T00-00-00Z"]);
});
