import { expect, test } from "bun:test";
import { AppSettings, AppSettingsPatch } from "./app-settings";
import { RpcRequest } from "./rpc";

test("agent execution is hidden by default", () => {
  expect(AppSettings.parse({})).toEqual({ agentExecution: "hidden" });
  expect(AppSettings.parse({ agentExecution: "shown" })).toEqual({ agentExecution: "shown" });
  expect(AppSettings.safeParse({ agentExecution: "off" }).success).toBe(false);
});

test("the settings patch is strict", () => {
  expect(AppSettingsPatch.parse({})).toEqual({});
  expect(AppSettingsPatch.parse({ agentExecution: "shown" })).toEqual({ agentExecution: "shown" });
  expect(AppSettingsPatch.safeParse({ theme: "dark" }).success).toBe(false);
});

test("the settings are read and patched by RPC", () => {
  expect(RpcRequest.safeParse({ method: "getAppSettings" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "setAppSettings", patch: { agentExecution: "shown" } }).success).toBe(
    true,
  );
  expect(RpcRequest.safeParse({ method: "setAppSettings", patch: { agentExecution: "on" } }).success).toBe(
    false,
  );
});
