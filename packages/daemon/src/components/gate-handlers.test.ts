import { expect, test } from "bun:test";
import { type CiRun, KiboError } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import type { FilesService } from "../files/service";
import type { ComponentIntegrationHooks, McpCallContext } from "../integrations/types";
import type { NotesService } from "../notes/service";
import { createGateHandlers } from "./gate-handlers";

const unused = (): never => {
  throw new Error("unused in this test");
};
const docs: Docs = {
  workspace: new LoroDoc(),
  project: unused,
  projectIds: unused,
  save: unused,
  emit: unused,
  run: unused,
  trigger: unused,
  replaceProject: unused,
  addProject: unused,
  removeProject: unused,
  onProjectRemoved: unused,
  imported: unused,
  onProjectDoc: unused,
  assertWritable: unused,
  setWriteGuard: unused,
  projectMeta: unused,
  updateProjectMeta: unused,
  identity: unused,
  setIdentity: unused,
};
const notes: NotesService = {
  info: unused,
  setDir: unused,
  handle: unused,
  refresh: unused,
  forget: unused,
  close: unused,
};
const fileCalls: unknown[] = [];
const files: FilesService = {
  dirOf: unused,
  info: unused,
  setDir: unused,
  list: async (projectId) => {
    fileCalls.push(["list", projectId]);
    return [];
  },
  remove: unused,
  uploads: { begin: unused, append: unused, finish: unused, cancel: unused, close: unused },
  url: async (projectId, instanceId, name) => {
    fileCalls.push(["url", projectId, instanceId, name]);
    return { url: "http://127.0.0.1:1/f/x/a.png", expiresAt: 1 };
  },
  open: unused,
  close: unused,
};
const ok = { content: [], isError: false, truncated: false };
const ciRun: CiRun = {
  repo: "adam/kibo",
  runId: 1,
  prNumber: null,
  ticketKey: null,
  headSha: "abc",
  workflow: "ci",
  status: "completed",
  conclusion: "success",
  url: "https://github.com/adam/kibo/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-09-26T10:00:00Z",
  jobs: [],
};

function hooks(seen: unknown[]): ComponentIntegrationHooks {
  const log = (ctx: McpCallContext, ...rest: unknown[]) =>
    seen.push([ctx.projectId, ctx.instanceId, ...rest]);
  return {
    aliases: new Map(),
    observe: () => {},
    secret: async () => null,
    design: null,
    ciRuns: async (projectId) => {
      seen.push(["ci", projectId]);
      return [ciRun];
    },
    mcp: {
      call: async (ctx, server, tool, args) => {
        log(ctx, server, tool, args);
        return ok;
      },
      read: async (ctx, server, uri) => {
        log(ctx, server, uri);
        return ok;
      },
      importItem: async (ctx, server, item) => {
        log(ctx, server, item);
        return unused();
      },
    },
  };
}

const handlersWith = (integrations: ComponentIntegrationHooks | null | undefined) =>
  createGateHandlers({
    docs,
    notes,
    files,
    backends: unused,
    runs: unused,
    ...(integrations !== undefined && { integrations: () => integrations }),
  });

test("mcp calls reach the hub gate with the calling instance", async () => {
  const seen: unknown[] = [];
  const h = handlersWith(hooks(seen));
  expect(await h.mcp("p", "i1", { kind: "mcp.call", server: "ctx", tool: "echo", args: { a: 1 } })).toEqual(
    ok,
  );
  expect(await h.mcp("p", "i1", { kind: "mcp.read", server: "ctx", uri: "fake://x" })).toEqual(ok);
  await expect(
    h.mcp("p", "i1", { kind: "mcp.import", server: "ctx", item: { itemId: "a", title: "A", url: null } }),
  ).rejects.toThrow("unused");
  expect(seen).toEqual([
    ["p", "i1", "ctx", "echo", { a: 1 }],
    ["p", "i1", "ctx", "fake://x"],
    ["p", "i1", "ctx", { itemId: "a", title: "A", url: null }],
  ]);
});

test("without a hub or a ci poller the calls fail with stable codes", async () => {
  for (const integrations of [undefined, null, { ...hooks([]), mcp: null, ciRuns: null }]) {
    const h = handlersWith(integrations);
    await expect(h.mcp("p", "i1", { kind: "mcp.read", server: "ctx", uri: "x" })).rejects.toThrow(
      "MCP_UNAVAILABLE",
    );
    await expect(h.list("p", "ci_run")).rejects.toThrow("NOT_CONNECTED");
  }
});

test("ci runs are listed per project", async () => {
  const seen: unknown[] = [];
  expect(await handlersWith(hooks(seen)).list("p", "ci_run")).toEqual([ciRun]);
  expect(seen).toEqual([["ci", "p"]]);
});

test("instance data writes go through the project write guard", async () => {
  const project = new LoroDoc();
  const guarded = createGateHandlers({
    docs: {
      ...docs,
      project: () => project,
      assertWritable: (projectId) => {
        throw new KiboError("FORBIDDEN", `project ${projectId} is read-only`);
      },
    },
    notes,
    files,
    backends: unused,
    runs: unused,
  });
  await expect(guarded.data("p", "i1", { kind: "data.set", key: "k", value: 1 })).rejects.toThrow(
    "FORBIDDEN",
  );
  expect(project.oplogVersion().length()).toBe(0);
});

test("project file calls reach the files service with the calling instance", async () => {
  const h = handlersWith(undefined);
  await h.assets("p", "i1", { kind: "assets.list" });
  await h.assets("p", "i1", { kind: "assets.url", name: "a.png" });
  expect(fileCalls).toEqual([
    ["list", "p"],
    ["url", "p", "i1", "a.png"],
  ]);
});

test("design frames reach the design gate with the calling instance, or fail when not started", async () => {
  const seen: unknown[] = [];
  const frame = { url: "https://www.figma.com/design/AbC123xyz/K?node-id=1-2", refresh: true };
  const h = handlersWith({
    ...hooks([]),
    design: {
      frame: async (ctx, url, refresh) => {
        seen.push([ctx.projectId, ctx.instanceId, url, refresh]);
        return unused();
      },
    },
  });
  await expect(h.design("p", "i1", { kind: "design.frame", ...frame })).rejects.toThrow("unused");
  expect(seen).toEqual([["p", "i1", frame.url, true]]);
  for (const integrations of [undefined, null, hooks([])])
    await expect(
      handlersWith(integrations).design("p", "i1", { kind: "design.frame", ...frame }),
    ).rejects.toThrow("NOT_CONNECTED");
});
