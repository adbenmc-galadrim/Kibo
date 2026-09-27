import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import {
  type ComponentCall,
  type GrantedPermissions,
  type Instance,
  KiboError,
  NO_PERMISSIONS,
} from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate, type GateHandlers, missingPermission } from "./gate";
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
  untrusted: instance("untrusted", "pending@0.1.0"),
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

function harness(granted: Partial<GrantedPermissions>, quotas: Quotas = createQuotas()) {
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
    action: async () => null,
    notes: async () => null,
    mcp: async (_p, instanceId, call) => {
      handled.push(`mcp:${instanceId}:${call.kind}`);
      return null;
    },
    presence: async () => [],
    sharing: async () => {
      throw new KiboError("INTERNAL", "unexpected");
    },
  };
  const gate = createGate({
    instance: (_p, id) => {
      const i = instances[id];
      if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
      return i;
    },
    active: (ref) => {
      if (ref === "evil@0.1.0")
        return { ref, trust: "sandboxed", granted: { ...NO_PERMISSIONS, ...granted } };
      throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
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
  test("a component granted no mcp rule reaches no server", async () => {
    const { gate, events } = harness({ writes: ["ticket"] });
    for (const call of [mcpCall, mcpRead, mcpImport]) await denied(gate.call("p", "thirdparty", call));
    expect(handled).toEqual([]);
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([
      ["mcp.call", "PERMISSION_DENIED"],
      ["mcp.read", "PERMISSION_DENIED"],
      ["mcp.import", "PERMISSION_DENIED"],
    ]);
  });

  test("follow the granted mcp rules of a sandboxed component", async () => {
    await harness({ mcp: ["ctx/echo"] }).gate.call("p", "thirdparty", mcpCall);
    await harness({ mcp: ["ctx"] }).gate.call("p", "thirdparty", mcpRead);
    expect(handled).toEqual(["mcp:thirdparty:mcp.call", "mcp:thirdparty:mcp.read"]);
  });

  test("a tool rule covers that tool only", async () => {
    const { gate } = harness({ mcp: ["ctx/echo"], writes: ["ticket"] });
    await denied(gate.call("p", "thirdparty", { ...mcpCall, tool: "drop" }));
    await denied(gate.call("p", "thirdparty", { ...mcpCall, tool: "echo/x" }));
    await denied(gate.call("p", "thirdparty", mcpRead));
    await denied(gate.call("p", "thirdparty", mcpImport));
    await denied(gate.call("p", "thirdparty", { ...mcpCall, server: "other" }));
    expect(handled).toEqual([]);
  });

  test("the config rule never covers a third-party component, whatever its config", async () => {
    const { gate } = harness({ mcp: ["{config.server}"], writes: ["ticket"] });
    for (const call of [mcpCall, mcpRead, mcpImport]) await denied(gate.call("p", "thirdparty", call));
    expect(handled).toEqual([]);
  });

  test("an import also needs write:ticket", async () => {
    await denied(harness({ mcp: ["ctx"] }).gate.call("p", "thirdparty", mcpImport), "write:ticket");
    expect(handled).toEqual([]);
    await harness({ mcp: ["ctx"], writes: ["ticket"] }).gate.call("p", "thirdparty", mcpImport);
    expect(handled).toEqual(["mcp:thirdparty:mcp.import"]);
  });

  test("an unapproved version and an unknown instance are refused before any mcp handler", async () => {
    const { gate } = harness({ mcp: ["ctx"] });
    await denied(gate.call("p", "untrusted", mcpCall), "TRUST_REQUIRED");
    await denied(gate.call("p", "ghost", mcpCall), "NOT_FOUND");
    expect(handled).toEqual([]);
  });

  test("an mcp call counts in the call quota of the instance", async () => {
    const { gate, events } = harness({ mcp: ["ctx"] }, createQuotas({ callsPerSecond: 1, now: () => 0 }));
    await gate.call("p", "thirdparty", mcpCall);
    await denied(gate.call("p", "thirdparty", mcpRead), "RATE_LIMITED");
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([["mcp.read", "RATE_LIMITED"]]);
  });

  test("mcp calls have their own per-minute quota, journaled (N47)", async () => {
    const { gate, events } = harness(
      { mcp: ["ctx"], writes: ["ticket"], data: true },
      createQuotas({ mcpPerMinute: 2 }),
    );
    await gate.call("p", "thirdparty", mcpCall);
    await gate.call("p", "thirdparty", mcpRead);
    await denied(gate.call("p", "thirdparty", mcpImport), "RATE_LIMITED");
    await gate.call("p", "thirdparty", { kind: "data.keys" });
    expect(handled).toEqual(["mcp:thirdparty:mcp.call", "mcp:thirdparty:mcp.read"]);
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([["mcp.import", "RATE_LIMITED"]]);
  });

  test("built-ins share the mcp quota", async () => {
    const { gate } = harness({}, createQuotas({ mcpPerMinute: 1 }));
    await gate.call("p", "builtin", mcpCall);
    await denied(gate.call("p", "builtin", mcpRead), "RATE_LIMITED");
  });

  test("built-ins skip the daemon grant check, their SDK checks the manifest", async () => {
    const { gate } = harness({});
    await gate.call("p", "builtin", mcpCall);
    await gate.call("p", "builtin", mcpImport);
    expect(handled).toEqual(["mcp:builtin:mcp.call", "mcp:builtin:mcp.import"]);
  });
});

describe("ci runs through componentCall", () => {
  test("need read:ci_run", async () => {
    await denied(harness({ reads: ["ticket", "run"] }).gate.call("p", "thirdparty", ciList));
    expect(handled).toEqual([]);
    await harness({ reads: ["ci_run"] }).gate.call("p", "thirdparty", ciList);
    expect(handled).toEqual(["list:ci_run"]);
  });
});

test("missingPermission names the mcp rule, then write:ticket", () => {
  const g = (p: Partial<GrantedPermissions>): GrantedPermissions => ({ ...NO_PERMISSIONS, ...p });
  expect(missingPermission(g({}), mcpCall)).toBe("mcp:ctx/echo");
  expect(missingPermission(g({}), mcpRead)).toBe("mcp:ctx");
  expect(missingPermission(g({ writes: ["ticket"] }), mcpImport)).toBe("mcp:ctx");
  expect(missingPermission(g({ mcp: ["ctx"] }), mcpImport)).toBe("write:ticket");
  expect(missingPermission(g({ mcp: ["ctx"], writes: ["ticket"] }), mcpImport)).toBeNull();
  expect(missingPermission(g({ mcp: ["ctx"] }), mcpCall)).toBeNull();
  expect(missingPermission(g({ net: ["ctx"], reads: ["ticket"] }), mcpRead)).toBe("mcp:ctx");
  expect(missingPermission(g({}), ciList)).toBe("read:ci_run");
});
