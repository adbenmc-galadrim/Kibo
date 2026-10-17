import { expect, test } from "bun:test";
import type { RpcRequest } from "../packages/schema/src/index";
import { EMIS_PROJECT } from "./fixtures/emis-maquettes";
import { shareEmis } from "./seed-emis-sync";

const SERVER = { serverUrl: "wss://127.0.0.1:4999", code: "CODE", caFile: "/tmp/ca.pem" };

function fakeDaemon(connected: boolean, shared: boolean) {
  const calls: RpcRequest[] = [];
  const rpc = async (req: RpcRequest): Promise<unknown> => {
    calls.push(req);
    if (req.method === "getSyncStatus") return { state: connected ? "online" : "unconfigured" };
    if (req.method === "listProjects") return [{ id: "emis-id", key: EMIS_PROJECT.key }];
    if (req.method === "getProject") return { sync: { shared } };
    return null;
  };
  return { rpc, methods: () => calls.map((c) => c.method), calls };
}

test("the seed connects the daemon to the sync server and shares Emis", async () => {
  const daemon = fakeDaemon(false, false);
  await shareEmis(daemon.rpc, SERVER);
  expect(daemon.calls).toContainEqual({
    method: "connectSyncServer",
    serverUrl: SERVER.serverUrl,
    code: SERVER.code,
    deviceName: "MacBook d'Adam",
    caFile: SERVER.caFile,
  });
  expect(daemon.calls).toContainEqual({ method: "shareProject", projectId: "emis-id" });
});

test("sharing again writes nothing", async () => {
  const daemon = fakeDaemon(true, true);
  await shareEmis(daemon.rpc, SERVER);
  expect(daemon.methods()).not.toContain("connectSyncServer");
  expect(daemon.methods()).not.toContain("shareProject");
});
