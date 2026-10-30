import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import type { ChangeMessage, RpcRequest } from "@kibo/schema";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { appSettingsRpc } from "./app-settings-rpc";
import { createAppSettingsStore } from "./app-settings-store";

const REMOTE: RpcContext = { sessionHash: "r", remote: true };

function setup() {
  const sent: ChangeMessage[] = [];
  const rpc = appSettingsRpc({
    store: createAppSettingsStore(new Database(":memory:", { strict: true }), () => 1),
    emit: (message) => sent.push(message),
  });
  return { rpc, sent };
}

test("the settings are read by any session; an empty patch is written from this machine", async () => {
  const { rpc, sent } = setup();
  expect(rpc.methods).toEqual(["getAppSettings", "setAppSettings"]);
  expect(await rpc.handle({ method: "getAppSettings" }, REMOTE)).toEqual({});
  expect(await rpc.handle({ method: "setAppSettings", patch: {} }, LOCAL_CONTEXT)).toEqual({});
  expect(sent).toEqual([{ topic: "config" }]);
});

test("a remote session cannot change the settings", async () => {
  const { rpc, sent } = setup();
  await expect(rpc.handle({ method: "setAppSettings", patch: {} }, REMOTE)).rejects.toThrow("FORBIDDEN");
  expect(sent).toEqual([]);
});

test("a patch naming the removed agent execution is refused and changes nothing", async () => {
  const { rpc, sent } = setup();
  const req = { method: "setAppSettings", patch: { agentExecution: "shown" } };
  await expect(rpc.handle(req as unknown as RpcRequest, LOCAL_CONTEXT)).rejects.toThrow("INVALID_INPUT");
  expect(sent).toEqual([]);
});
