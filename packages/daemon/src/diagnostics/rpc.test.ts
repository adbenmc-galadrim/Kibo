import { expect, test } from "bun:test";
import type { AppInfo, Diagnostics } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { appRpc } from "./rpc";

const app: AppInfo = {
  version: "1.5.0",
  platform: "linux",
  arch: "x64",
  home: "~/.kibo",
  daemonPid: 3,
  uptimeMs: 0,
};
const report: Diagnostics = {
  app,
  environment: {
    app,
    daemon: { address: "127.0.0.1:4317", home: "~/.kibo" },
    ai: {
      available: false,
      reason: "missing",
      version: null,
      loggedIn: null,
      profiles: { assistant: false, generateur: false },
    },
    git: null,
    gh: null,
    capacity: { cores: 4, ramGb: 8, hostSlots: 1 },
    github: { connected: false },
  },
  counts: { projects: 0, tickets: 0, components: 0, instances: 0, profiles: 0 },
  integrations: [],
  log: [],
};
const remote = { sessionHash: "abc", remote: true };
let diagnosticsCalls = 0;
const rpc = appRpc({
  appInfo: () => app,
  diagnostics: async () => {
    diagnosticsCalls++;
    return report;
  },
});

test("appRpc declares its two methods", () => {
  expect(rpc.methods).toEqual(["getAppInfo", "getDiagnostics"]);
});

test("getAppInfo is open, even to a remote session", async () => {
  expect(await rpc.handle({ method: "getAppInfo" }, remote)).toEqual(app);
  expect(await rpc.handle({ method: "getAppInfo" }, LOCAL_CONTEXT)).toEqual(app);
});

test("getDiagnostics is refused from a remote session", async () => {
  await expect(rpc.handle({ method: "getDiagnostics" }, remote)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(diagnosticsCalls).toBe(0);
  expect(await rpc.handle({ method: "getDiagnostics" }, LOCAL_CONTEXT)).toEqual(report);
  expect(diagnosticsCalls).toBe(1);
});

test("another method is an internal error", async () => {
  await expect(rpc.handle({ method: "listProjects" }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INTERNAL",
  });
});
