import { describe, expect, test } from "bun:test";
import type { CiRun, ComponentCall, ComponentManifestInput } from "@kibo/schema";
import { ComponentManifest } from "@kibo/schema";
import { createMockSdk } from "./mock";
import { createSdk } from "./sdk";
import type { ProjectBackend } from "./types";

const manifest: ComponentManifestInput = {
  id: "probe",
  version: "1.0.0",
  kind: "widget",
  title: "Probe",
  reads: ["ticket", "ci_run"],
  writes: ["ticket"],
  mcp: ["ctx"],
};
const ok = { content: [{ type: "text" as const, text: "hi" }], isError: false, truncated: false };
const run: CiRun = {
  repo: "adam/kibo",
  runId: 1,
  prNumber: 12,
  ticketKey: "KIB-7",
  headSha: "abc",
  workflow: "ci",
  status: "completed",
  conclusion: "success",
  url: "https://github.com/adam/kibo/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-09-26T10:00:00Z",
  jobs: [],
};

describe("sdk.mcp", () => {
  test("calls declared servers and records the usage", async () => {
    const m = createMockSdk(manifest, { mcp: { "ctx/echo": ok } });
    expect(await m.sdk.mcp.call("ctx", "echo", { text: "hi" })).toEqual(ok);
    expect(m.used).toContain("mcp:ctx/echo");
  });

  test("undeclared servers are denied and recorded", async () => {
    const m = createMockSdk(manifest);
    await expect(m.sdk.mcp.call("fs", "read")).rejects.toThrow("PERMISSION_DENIED");
    await expect(m.sdk.mcp.read("fs", "fake://items")).rejects.toThrow("PERMISSION_DENIED");
    await expect(m.sdk.mcp.importItem("fs", { itemId: "a", title: "A", url: null })).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    expect(m.violations).toEqual(["mcp fs/read", "mcp fs", "mcp fs"]);
  });

  test("a tool rule covers that tool only, never the whole server", async () => {
    const m = createMockSdk({ ...manifest, mcp: ["ctx/echo"] }, { mcp: { "ctx/echo": ok } });
    expect(await m.sdk.mcp.call("ctx", "echo")).toEqual(ok);
    await expect(m.sdk.mcp.call("ctx", "drop")).rejects.toThrow("PERMISSION_DENIED");
    await expect(m.sdk.mcp.read("ctx", "fake://items")).rejects.toThrow("PERMISSION_DENIED");
    await expect(m.sdk.mcp.importItem("ctx", { itemId: "a", title: "A", url: null })).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  });

  test("a manifest without mcp can reach no server", async () => {
    const m = createMockSdk({ ...manifest, mcp: [] }, { mcp: { "ctx/echo": ok } });
    await expect(m.sdk.mcp.call("ctx", "echo")).rejects.toThrow("PERMISSION_DENIED");
    expect(m.violations).toEqual(["mcp ctx/echo"]);
  });

  test("a builtin rule resolved from the instance config", async () => {
    const m = createMockSdk(
      { ...manifest, mcp: ["{config.server}"] },
      { config: { server: "fs" }, mcp: { "fs@fake://items": ok } },
    );
    expect(await m.sdk.mcp.read("fs", "fake://items")).toEqual(ok);
    await expect(m.sdk.mcp.read("ctx", "fake://items")).rejects.toThrow("PERMISSION_DENIED");
  });

  test("the config rule covers nothing without a server in the config", async () => {
    const m = createMockSdk({ ...manifest, mcp: ["{config.server}"] }, { config: { server: 3 } });
    await expect(m.sdk.mcp.read("fs", "fake://items")).rejects.toThrow("PERMISSION_DENIED");
    await expect(m.sdk.mcp.call("{config.server}", "x")).rejects.toThrow("PERMISSION_DENIED");
  });

  test("an unprogrammed response is a stable MCP failure", async () => {
    const m = createMockSdk(manifest);
    await expect(m.sdk.mcp.call("ctx", "echo")).rejects.toThrow("MCP_FAILED");
    expect(m.violations).toEqual([]);
  });

  test("importItem creates a ticket with its mcp ref, once", async () => {
    const m = createMockSdk(manifest);
    const a = await m.sdk.mcp.importItem("ctx", {
      itemId: "a1",
      title: "Premier",
      url: "https://example.com/a1",
    });
    const b = await m.sdk.mcp.importItem("ctx", { itemId: "a1", title: "Premier", url: null });
    expect(b.id).toBe(a.id);
    expect(a.externalRefs).toEqual([
      { kind: "mcp_item", server: "ctx", itemId: "a1", url: "https://example.com/a1", title: "Premier" },
    ]);
    expect(m.used).toEqual(["write:ticket", "mcp:ctx"]);
  });

  test("importItem also needs write:ticket", async () => {
    const m = createMockSdk({ ...manifest, writes: [] });
    await expect(m.sdk.mcp.importItem("ctx", { itemId: "a1", title: "A", url: null })).rejects.toThrow(
      "write ticket",
    );
    expect(m.snapshot().tickets).toEqual([]);
    expect(m.violations).toEqual(["mcp ctx"]);
  });

  test("ci runs are readable with the ci_run permission only", async () => {
    expect(await createMockSdk(manifest, { ciRuns: [run] }).sdk.list("ci_run")).toEqual([run]);
    const denied = createMockSdk({ ...manifest, reads: ["ticket"] }, { ciRuns: [run] });
    await expect(denied.sdk.list("ci_run")).rejects.toThrow("PERMISSION_DENIED");
    expect(denied.violations).toEqual(["read ci_run"]);
  });
});

describe("sdk.mcp over the backend", () => {
  const backend = (calls: ComponentCall[]): ProjectBackend => ({
    snapshot: async () => {
      throw new Error("no snapshot");
    },
    run: async () => null,
    call: async (c) => {
      calls.push(c);
      return c.kind === "list" ? [run] : ok;
    },
    subscribe: () => () => {},
    runs: async () => [],
    subscribeRuns: () => () => {},
  });
  const ctx = {
    instanceId: "i1",
    config: {},
    viewer: "adam",
    surface: "widget" as const,
    openTicket: () => {},
    openNewTicket: () => {},
    openFile: () => {},
    openView: () => {},
  };

  for (const mode of ["builtin", "gated"] as const) {
    test(`${mode}: every mcp call and ci_run go through componentCall`, async () => {
      const calls: ComponentCall[] = [];
      const sdk = createSdk(backend(calls), ComponentManifest.parse(manifest), ctx, mode);
      await sdk.mcp.call("ctx", "echo");
      await sdk.mcp.read("ctx", "fake://x");
      await sdk.mcp.importItem("ctx", { itemId: "a", title: "A", url: null });
      expect(await sdk.list("ci_run")).toEqual([run]);
      expect(calls).toEqual([
        { kind: "mcp.call", server: "ctx", tool: "echo", args: {} },
        { kind: "mcp.read", server: "ctx", uri: "fake://x" },
        { kind: "mcp.import", server: "ctx", item: { itemId: "a", title: "A", url: null } },
        { kind: "list", entity: "ci_run" },
      ]);
    });

    test(`${mode}: a refused call never reaches the backend`, async () => {
      const calls: ComponentCall[] = [];
      const sdk = createSdk(
        backend(calls),
        ComponentManifest.parse({ ...manifest, reads: [], writes: [], mcp: ["ctx/echo"] }),
        ctx,
        mode,
      );
      await expect(sdk.mcp.call("ctx", "other")).rejects.toThrow("PERMISSION_DENIED");
      await expect(sdk.mcp.read("ctx", "fake://x")).rejects.toThrow("PERMISSION_DENIED");
      await expect(sdk.mcp.importItem("ctx", { itemId: "a", title: "A", url: null })).rejects.toThrow(
        "PERMISSION_DENIED",
      );
      await expect(sdk.list("ci_run")).rejects.toThrow("PERMISSION_DENIED");
      expect(calls).toEqual([]);
    });
  }
});
