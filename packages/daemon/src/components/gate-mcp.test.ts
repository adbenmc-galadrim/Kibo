import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { type ComponentCall, DEFAULT_COMPONENT_SETTINGS, type Instance, KiboError } from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate, type GateHandlers } from "./gate";
import { createQuotas, type Quotas } from "./quotas";

const instance = (id: string, component: string, config: Record<string, unknown> = {}): Instance => ({
  id,
  pageId: "pg",
  component,
  layout: { x: 0, y: 0, w: 6, h: 4 },
  config,
  componentHash: null,
});
const instances: Record<string, Instance> = {
  thirdparty: instance("thirdparty", "evil@0.1.0", { server: "ctx" }),
  builtin: instance("builtin", "kanban@1.0.0", { server: "ctx" }),
};

const item = { itemId: "a1", title: "A", url: null };
const mcpCall: ComponentCall = { kind: "mcp.call", server: "ctx", tool: "echo", args: {} };
const mcpRead: ComponentCall = { kind: "mcp.read", server: "ctx", uri: "fake://items" };
const mcpImport: ComponentCall = { kind: "mcp.import", server: "ctx", item };
const ciList: ComponentCall = { kind: "list", entity: "ci_run" };

let handled: string[] = [];
beforeEach(() => {
  handled = [];
});

function harness(quotas: Quotas = createQuotas()) {
  const db = new Database(":memory:");
  ensureEventsTable(db);
  const events = createEventLog(db, () => 42);
  const handlers: GateHandlers = {
    list: async (_p, entity) => {
      handled.push(`list:${entity}`);
      return [];
    },
    run: async () => null,
    data: async () => null,
    fetch: async () => ({ status: 200, headers: {}, body: "" }),
    mcp: async (_p, instanceId, call) => {
      handled.push(`mcp:${instanceId}:${call.kind}`);
      return null;
    },
    assets: async () => null,
    design: async () => null,
    embed: async () => null,
    config: async () => null,
    presence: async () => [],
    sharing: async () => {
      throw new KiboError("INTERNAL", "unexpected");
    },
    settings: async () => DEFAULT_COMPONENT_SETTINGS,
    project: async () => {
      throw new KiboError("INTERNAL", "unexpected");
    },
    recipients: async () => [],
  };
  const gate = createGate({
    instance: (_p, id) => {
      const i = instances[id];
      if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
      return i;
    },
    handlers,
    quotas,
    events,
  });
  return { gate, events };
}

const denied = async (p: Promise<unknown>, code = "PERMISSION_DENIED") => {
  await expect(p).rejects.toThrow(code);
};

describe("mcp calls through componentCall", () => {
  test("a third-party ref and an unknown instance are refused before any mcp handler", async () => {
    const { gate } = harness();
    await denied(gate.call("p", "thirdparty", mcpCall), "NOT_FOUND");
    await denied(gate.call("p", "ghost", mcpCall), "NOT_FOUND");
    expect(handled).toEqual([]);
  });

  test("an mcp call counts in the call quota of the instance", async () => {
    const { gate, events } = harness(createQuotas({ callsPerSecond: 1, now: () => 0 }));
    await gate.call("p", "builtin", mcpCall);
    await denied(gate.call("p", "builtin", mcpRead), "RATE_LIMITED");
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([["mcp.read", "RATE_LIMITED"]]);
  });

  test("mcp calls have their own per-minute quota, journaled (N47)", async () => {
    const { gate, events } = harness(createQuotas({ mcpPerMinute: 2 }));
    await gate.call("p", "builtin", mcpCall);
    await gate.call("p", "builtin", mcpRead);
    await denied(gate.call("p", "builtin", mcpImport), "RATE_LIMITED");
    await gate.call("p", "builtin", { kind: "data.keys" });
    expect(handled).toEqual(["mcp:builtin:mcp.call", "mcp:builtin:mcp.read"]);
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([["mcp.import", "RATE_LIMITED"]]);
  });

  test("built-ins skip the daemon grant check, their SDK checks the manifest", async () => {
    const { gate } = harness();
    await gate.call("p", "builtin", mcpCall);
    await gate.call("p", "builtin", mcpImport);
    expect(handled).toEqual(["mcp:builtin:mcp.call", "mcp:builtin:mcp.import"]);
  });
});

test("ci runs reach the list handler", async () => {
  await harness().gate.call("p", "builtin", ciList);
  expect(handled).toEqual(["list:ci_run"]);
});
