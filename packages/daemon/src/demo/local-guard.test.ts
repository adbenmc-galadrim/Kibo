import { expect, test } from "bun:test";
import type { ProjectCommand, RpcRequest } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { demoCommandGuard, demoRpcGuard } from "./local-guard";

const isDemo = (projectId: string) => projectId === "demo";
const guard = demoRpcGuard(isDemo);
const config = { repo: "adam/kibo", project: null, importClosed: false, labels: [] };
const binding = { id: "b1", adapter: "github-issues", config, createdBy: "adam", runner: "adam" } as const;

const REFUSED: ((projectId: string) => RpcRequest)[] = [
  (projectId) => ({ method: "shareProject", projectId }),
  (projectId) => ({ method: "createProjectInvite", projectId, role: "editor" }),
  (projectId) => ({ method: "createBinding", projectId, config }),
  (projectId) => ({ method: "updateProject", projectId, patch: { folder: "/Users/adam/code/kibo" } }),
  (projectId) => ({ method: "command", projectId, command: { method: "addBinding", binding } }),
];

test("sharing, bindings and a code folder are refused on the demo project", async () => {
  for (const req of REFUSED)
    await expect(guard(req("demo"), LOCAL_CONTEXT)).rejects.toThrow(
      "INVALID_INPUT: the demo project stays local",
    );
});

test("the same requests on another project are left to the next handler", async () => {
  for (const req of REFUSED) expect(await guard(req("kib"), LOCAL_CONTEXT)).toEqual({ handled: false });
});

test("ordinary edits of the demo project pass", async () => {
  const allowed: RpcRequest[] = [
    { method: "updateProject", projectId: "demo", patch: { name: "Ma démo" } },
    { method: "updateProject", projectId: "demo", patch: { folder: null } },
    { method: "command", projectId: "demo", command: { method: "createTicket", title: "T" } },
    { method: "listProjects" },
  ];
  for (const req of allowed) expect(await guard(req, LOCAL_CONTEXT)).toEqual({ handled: false });
});

test("the command guard refuses addBinding on the demo project whatever the path", () => {
  const intercept = demoCommandGuard(isDemo);
  const add: ProjectCommand = { method: "addBinding", binding };
  const meta = { origin: "user", instanceId: null } as const;
  expect(() => intercept("demo", add, meta)).toThrow("INVALID_INPUT: the demo project stays local");
  expect(intercept("kib", add, meta)).toBe(add);
  const create: ProjectCommand = { method: "createTicket", title: "T" };
  expect(intercept("demo", create, meta)).toBe(create);
});
