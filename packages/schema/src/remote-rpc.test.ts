import { expect, test } from "bun:test";
import { KIBO_ERROR_CODES } from "./errors";
import { REMOTE_RPC_METHODS } from "./remote-rpc";
import { RpcRequest } from "./rpc";

const enable = { method: "remote.enable", serverUrl: "https://kibo.shinseo.fr", setupCode: "silo-setup" };

test("every remote method is part of the RPC request union", () => {
  expect(REMOTE_RPC_METHODS).toEqual([
    "remote.status",
    "remote.enable",
    "remote.disable",
    "remote.setProjects",
    "remote.createPairing",
    "remote.revokePhone",
  ]);
  for (const method of ["remote.status", "remote.disable", "remote.createPairing", "remote.revokePhone"]) {
    expect(RpcRequest.safeParse({ method }).success).toBe(true);
  }
  expect(RpcRequest.parse({ method: "remote.setProjects", projectIds: ["p1"] }).method).toBe(
    "remote.setProjects",
  );
  expect(RpcRequest.safeParse({ method: "remote.setProjects", projectIds: [""] }).success).toBe(false);
});

test("remote.enable requires https or the loopback address", () => {
  expect(RpcRequest.safeParse(enable).success).toBe(true);
  expect(RpcRequest.safeParse({ ...enable, serverUrl: "http://127.0.0.1:8080" }).success).toBe(true);
  for (const serverUrl of [
    "http://kibo.shinseo.fr",
    "http://localhost:8080",
    "ftp://kibo.shinseo.fr",
    "kibo",
  ]) {
    expect(RpcRequest.safeParse({ ...enable, serverUrl }).success).toBe(false);
  }
});

test("remote.enable requires a setup code of 8 to 64 characters", () => {
  expect(RpcRequest.safeParse({ ...enable, setupCode: "a".repeat(8) }).success).toBe(true);
  expect(RpcRequest.safeParse({ ...enable, setupCode: "a".repeat(64) }).success).toBe(true);
  expect(RpcRequest.safeParse({ ...enable, setupCode: "a".repeat(7) }).success).toBe(false);
  expect(RpcRequest.safeParse({ ...enable, setupCode: "a".repeat(65) }).success).toBe(false);
});

test("the remote errors are stable codes", () => {
  for (const code of ["REMOTE_PAIRING_INVALID", "REMOTE_DISABLED", "REMOTE_TOO_LARGE"] as const) {
    expect(KIBO_ERROR_CODES).toContain(code);
  }
});
