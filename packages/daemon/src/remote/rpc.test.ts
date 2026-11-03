import { expect, test } from "bun:test";
import { KiboError, REMOTE_RPC_METHODS, type RemoteStatus, type RpcRequest } from "@kibo/schema";
import { type RemoteController, remoteRpc } from "./rpc";

const STATUS: RemoteStatus = {
  enabled: false,
  serverUrl: "https://kibo.shinseo.fr",
  connected: false,
  lastPushAt: null,
  projects: [],
  phonePaired: false,
  keyEpoch: 0,
};

function controller(calls: string[]): RemoteController {
  const answer = (name: string) => async () => {
    calls.push(name);
    return STATUS;
  };
  return {
    status: answer("status"),
    enable: answer("enable"),
    disable: answer("disable"),
    setProjects: answer("setProjects"),
    revokePhone: answer("revokePhone"),
    createPairing: async () => {
      calls.push("createPairing");
      return { code: "kibo1.x", expiresAt: 1 };
    },
  };
}

const REQUESTS: RpcRequest[] = [
  { method: "remote.status" },
  { method: "remote.enable", serverUrl: "https://kibo.shinseo.fr", setupCode: "code-silo-0001" },
  { method: "remote.disable" },
  { method: "remote.setProjects", projectIds: ["silo"] },
  { method: "remote.createPairing" },
  { method: "remote.revokePhone" },
];

test("the extension declares every remote.* method", () => {
  expect([...remoteRpc(controller([])).methods].sort()).toEqual([...REMOTE_RPC_METHODS].sort());
  expect(REQUESTS.map((r) => r.method).sort()).toEqual([...REMOTE_RPC_METHODS].sort());
});

test("remote.* require local", async () => {
  const calls: string[] = [];
  const rpc = remoteRpc(controller(calls));
  for (const req of REQUESTS) {
    const refused = await rpc.handle(req, { sessionHash: "phone", remote: true }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(KiboError);
    expect(refused instanceof KiboError && refused.code).toBe("FORBIDDEN");
  }
  expect(calls).toEqual([]);
  for (const req of REQUESTS) await rpc.handle(req, { sessionHash: "local", remote: false });
  expect(calls).toEqual(["status", "enable", "disable", "setProjects", "createPairing", "revokePhone"]);
});
