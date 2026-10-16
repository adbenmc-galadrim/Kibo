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

const show: RpcRequest = { method: "setAppSettings", patch: { agentExecution: "shown" } };

test("the settings are read by any session and written from this machine, with a config message", async () => {
  const { rpc, sent } = setup();
  expect(rpc.methods).toEqual(["getAppSettings", "setAppSettings"]);
  expect(await rpc.handle({ method: "getAppSettings" }, REMOTE)).toEqual({ agentExecution: "hidden" });
  expect(await rpc.handle(show, LOCAL_CONTEXT)).toEqual({ agentExecution: "shown" });
  expect(sent).toEqual([{ topic: "config" }]);
  expect(await rpc.handle({ method: "getAppSettings" }, LOCAL_CONTEXT)).toEqual({ agentExecution: "shown" });
});

test("a remote session cannot change the settings", async () => {
  const { rpc, sent } = setup();
  await expect(rpc.handle(show, REMOTE)).rejects.toThrow("FORBIDDEN");
  expect(sent).toEqual([]);
  expect(await rpc.handle({ method: "getAppSettings" }, LOCAL_CONTEXT)).toEqual({ agentExecution: "hidden" });
});

test("a malformed patch is refused", async () => {
  const { rpc } = setup();
  const req = { method: "setAppSettings", patch: { agentExecution: "maybe" } };
  await expect(rpc.handle(req as unknown as RpcRequest, LOCAL_CONTEXT)).rejects.toThrow("INVALID_INPUT");
});
