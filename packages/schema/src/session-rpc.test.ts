import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";

test("session RPCs parse and remote access RPCs are gone", () => {
  expect(RpcRequest.safeParse({ method: "listSessions" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "revokeSession", id: "a".repeat(64) }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "revokeSession", id: "x" }).success).toBe(false);
  for (const method of [
    "getRemoteAccess",
    "enableRemoteAccess",
    "disableRemoteAccess",
    "createPairingCode",
  ]) {
    expect(RpcRequest.safeParse({ method }).success).toBe(false);
  }
});
