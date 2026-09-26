import { describe, expect, test } from "bun:test";
import { createProjectDoc, readProject } from "@kibo/core";
import { type ComponentCall, ComponentManifest, type TicketRun } from "@kibo/schema";
import { defineMigrations } from "./migrations";
import { createSdk } from "./sdk";
import { defineServer } from "./server";
import type { ProjectBackend, SdkContext, SdkMode } from "./types";

const ctx: SdkContext = {
  instanceId: "i1",
  config: {},
  viewer: "adam",
  surface: "widget",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};

const run: TicketRun = {
  ticketId: "1@1",
  runId: "r1",
  label: "opus-dev-1",
  state: "running",
  position: null,
};

function setup(extra: Record<string, unknown>, mode: SdkMode = "builtin") {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  const calls: ComponentCall[] = [];
  const runs: unknown[] = [];
  const backend: ProjectBackend = {
    snapshot: async () => readProject(doc),
    run: async (cmd) => {
      runs.push(cmd);
      return null;
    },
    call: async (c) => {
      calls.push(c);
      return c.kind === "data.keys" ? ["a"] : [];
    },
    subscribe: () => () => undefined,
    runs: async () => [run],
    subscribeRuns: () => () => undefined,
  };
  const manifest = ComponentManifest.parse({
    id: "probe",
    version: "1.0.0",
    kind: "both",
    title: "Probe",
    reads: [],
    writes: [],
    ...extra,
  });
  return { sdk: createSdk(backend, manifest, ctx, mode), calls, runs };
}

describe("builtin mode", () => {
  test("entities come from the snapshot, notes from componentCall", async () => {
    const { sdk, calls } = setup({ reads: ["status", "note", "run"] });
    expect((await sdk.list("status")).length).toBe(6);
    expect(await sdk.list("run")).toEqual([run]);
    await sdk.list("note");
    expect(calls).toEqual([{ kind: "list", entity: "note" }]);
    expect(sdk.surface).toBe("widget");
  });
  test("run goes to the command bus", async () => {
    const { sdk, runs, calls } = setup({ writes: ["ticket"] });
    await sdk.run({ method: "createTicket", title: "A" });
    expect(runs).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});

describe("gated mode", () => {
  test("list and run go through componentCall", async () => {
    const { sdk, calls, runs } = setup({ reads: ["ticket", "run"], writes: ["ticket"] }, "gated");
    await sdk.list("ticket");
    await sdk.list("run");
    await sdk.run({ method: "createTicket", title: "A" });
    expect(calls.map((c) => c.kind)).toEqual(["list", "list", "run"]);
    expect(runs).toEqual([]);
  });
});

describe("new capabilities", () => {
  test("data needs data: true", async () => {
    const denied = setup({});
    await expect(denied.sdk.data.set("k", 1)).rejects.toThrow("PERMISSION_DENIED");
    expect(denied.calls).toEqual([]);
    const allowed = setup({ data: true });
    await allowed.sdk.data.set("k", 1);
    expect(await allowed.sdk.data.keys()).toEqual(["a"]);
    expect(allowed.calls[0]).toEqual({ kind: "data.set", key: "k", value: 1 });
  });
  test("fetch needs a covering net rule and sends a complete init", async () => {
    const { sdk, calls } = setup({ net: ["api.github.com/graphql"] });
    await expect(sdk.fetch("https://example.com")).rejects.toThrow("PERMISSION_DENIED");
    await sdk.fetch("https://api.github.com/graphql", { method: "POST", body: "{}" });
    expect(calls).toEqual([
      {
        kind: "fetch",
        url: "https://api.github.com/graphql",
        init: { method: "POST", headers: {}, body: "{}" },
      },
    ]);
  });
  test("notes need read or write note", async () => {
    const reader = setup({ reads: ["note"] });
    await reader.sdk.notes.read("a.md");
    await reader.sdk.notes.search("loro");
    await reader.sdk.notes.info();
    await expect(reader.sdk.notes.write("a.md", "x", null)).rejects.toThrow("PERMISSION_DENIED");
    expect(reader.calls.map((c) => c.kind)).toEqual(["notes.read", "notes.search", "notes.info"]);
  });
  test("actions always reach the backend, reserved commands never do", async () => {
    const { sdk, calls } = setup({ writes: ["ticket"] }, "gated");
    await sdk.action("ping");
    expect(calls).toEqual([{ kind: "action", name: "ping", input: null }]);
    await expect(sdk.run({ method: "setInstanceData", instanceId: "x", key: "k", value: 1 })).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    expect(calls).toHaveLength(1);
  });
});

test("defineServer and defineMigrations validate their shape", () => {
  expect(() => defineServer({ jobs: { sync: { everyMinutes: 0, run: async () => undefined } } })).toThrow(
    "INVALID_INPUT",
  );
  expect(defineServer({ actions: { ping: async () => "pong" } }).actions?.ping).toBeDefined();
  expect(() => defineMigrations({ 0: {} })).toThrow("INVALID_INPUT");
  expect(Object.keys(defineMigrations({ 1: {}, 2: {} }))).toEqual(["1", "2"]);
});
