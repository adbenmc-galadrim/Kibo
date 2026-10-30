import { expect, test } from "bun:test";
import { AppSettings, AppSettingsPatch } from "./app-settings";
import { RpcRequest } from "./rpc";

test("the agent execution is no longer a setting", () => {
  expect(AppSettings.parse({ agentExecution: "shown" })).toEqual({});
  expect(AppSettingsPatch.parse({})).toEqual({});
  expect(AppSettingsPatch.safeParse({ agentExecution: "shown" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "getAppSettings" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "setAppSettings", patch: { agentExecution: "shown" } }).success).toBe(
    false,
  );
});
