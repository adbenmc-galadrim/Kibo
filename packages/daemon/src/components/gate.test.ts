import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  type Binding,
  BuiltinEntityType,
  type ComponentCall,
  type ExternalRef,
  type GrantedPermissions,
  type Instance,
  KiboError,
} from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate, missingPermission } from "./gate";
import { createQuotas } from "./quotas";

const granted: GrantedPermissions = {
  reads: ["ticket"],
  writes: [],
  data: true,
  net: ["api.github.com/graphql"],
  secrets: [],
  mcp: [],
};
const instances: Record<string, Instance> = {
  thirdparty: {
    id: "thirdparty",
    pageId: "pg",
    component: "evil@0.1.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  },
  builtin: {
    id: "builtin",
    pageId: "pg",
    component: "notes@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  },
  untrusted: {
    id: "untrusted",
    pageId: "pg",
    component: "pending@0.1.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  },
};

let handled: string[] = [];
let db: Database;
function gate(quotas = createQuotas()) {
  db = new Database(":memory:");
  ensureEventsTable(db);
  const events = createEventLog(db, () => 42);
  const handler = (name: string) => async () => {
    handled.push(name);
    return name;
  };
  return {
    events,
    gate: createGate({
      instance: (_p, id) => {
        const i = instances[id];
        if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
        return i;
      },
      active: (ref) => {
        if (ref === "evil@0.1.0") return { ref, trust: "sandboxed", granted };
        throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
      },
      handlers: {
        list: handler("list"),
        run: handler("run"),
        data: handler("data"),
        fetch: async (grant) => {
          handled.push(`fetch:${grant === null ? "any" : grant.net.join(",")}`);
          return { status: 200, headers: {}, body: "" };
        },
        action: handler("action"),
        notes: handler("notes"),
        mcp: handler("mcp"),
      },
      quotas,
      events,
    }),
  };
}

beforeEach(() => {
  handled = [];
});

const refused = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toThrow(code);
};

describe("componentCall checks, in order", () => {
  test("1. the instance must exist", async () => {
    const { gate: g, events } = gate();
    await refused(g.call("p1", "ghost", { kind: "list", entity: "ticket" }), "NOT_FOUND");
    expect(events.list().map((e) => e.code)).toEqual(["NOT_FOUND"]);
  });
  test("2. a third-party version must be approved", async () => {
    const { gate: g } = gate();
    await refused(g.call("p1", "untrusted", { kind: "list", entity: "ticket" }), "TRUST_REQUIRED");
    expect(handled).toEqual([]);
  });
  test("3. granted permissions decide, not the manifest on disk", async () => {
    const { gate: g, events } = gate();
    await g.call("p1", "thirdparty", { kind: "list", entity: "ticket" });
    await refused(g.call("p1", "thirdparty", { kind: "list", entity: "link" }), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "thirdparty", { kind: "run", command: { method: "deleteTicket", ticketId: "t" } }),
      "PERMISSION_DENIED",
    );
    await refused(g.call("p1", "thirdparty", { kind: "notes.read", path: "a.md" }), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "thirdparty", {
        kind: "fetch",
        url: "https://example.com",
        init: { method: "GET", headers: {} },
      }),
      "PERMISSION_DENIED",
    );
    await g.call("p1", "thirdparty", { kind: "data.keys" });
    await g.call("p1", "thirdparty", {
      kind: "fetch",
      url: "https://api.github.com/graphql",
      init: { method: "POST", headers: {} },
    });
    await g.call("p1", "thirdparty", { kind: "action", name: "ping", input: null });
    expect(handled).toEqual(["list", "data", "fetch:api.github.com/graphql", "action"]);
    expect(events.list()).toHaveLength(4);
    expect(events.list()[0]).toEqual({
      at: 42,
      projectId: "p1",
      instanceId: "thirdparty",
      ref: "evil@0.1.0",
      kind: "list",
      code: "PERMISSION_DENIED",
      count: 1,
    });
  });
  test("reserved commands are refused for everyone, built-ins included", async () => {
    const { gate: g } = gate();
    const reserved: ComponentCall = {
      kind: "run",
      command: { method: "setInstanceData", instanceId: "x", key: "k", value: 1 },
    };
    await refused(g.call("p1", "thirdparty", reserved), "PERMISSION_DENIED");
    await refused(g.call("p1", "builtin", reserved), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "builtin", {
        kind: "run",
        command: { method: "addInstance", pageId: "pg", component: "x@1.0.0" },
      }),
      "PERMISSION_DENIED",
    );
    expect(handled).toEqual([]);
  });
  test("external refs and bindings are refused to every component", async () => {
    const { gate: g } = gate();
    const binding: Binding = {
      id: "b1",
      adapter: "github-issues",
      config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
      createdBy: "adam",
      runner: "adam",
    };
    const ref: ExternalRef = {
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: null,
      nodeId: null,
      url: null,
    };
    const forged: ComponentCall = {
      kind: "run",
      command: { method: "upsertExternalRef", ticketId: "t1", ref },
    };
    const commands: ComponentCall[] = [
      forged,
      { kind: "run", command: { method: "removeExternalRef", ticketId: "t1", kind: "github_pr", key: "x" } },
      { kind: "run", command: { method: "addBinding", binding } },
      { kind: "run", command: { method: "removeBinding", bindingId: "b1" } },
      {
        kind: "run",
        command: { method: "importExternalTicket", title: "X", ref },
      },
    ];
    for (const call of commands) {
      await refused(g.call("p1", "thirdparty", call), "PERMISSION_DENIED");
      await refused(g.call("p1", "builtin", call), "PERMISSION_DENIED");
    }
    const everything: GrantedPermissions = { ...granted, writes: [...BuiltinEntityType.options] };
    expect(missingPermission(everything, forged)).toBe("write:upsertExternalRef");
    expect(handled).toEqual([]);
  });
  test("built-ins skip trust and grant checks but not the fetch guard", async () => {
    const { gate: g } = gate();
    await g.call("p1", "builtin", { kind: "notes.read", path: "a.md" });
    await g.call("p1", "builtin", {
      kind: "fetch",
      url: "https://example.com",
      init: { method: "GET", headers: {} },
    });
    expect(handled).toEqual(["notes", "fetch:any"]);
  });
  test("5. quotas refuse bursts and are journaled", async () => {
    const { gate: g, events } = gate(createQuotas({ callsPerSecond: 1, now: () => 0 }));
    await g.call("p1", "thirdparty", { kind: "data.keys" });
    await refused(g.call("p1", "thirdparty", { kind: "data.keys" }), "RATE_LIMITED");
    expect(events.list().map((e) => e.code)).toEqual(["RATE_LIMITED"]);
  });
  test("refusals raised by handlers are journaled too", async () => {
    const { gate: g, events } = gate();
    const deny = createGate({
      instance: () => instances.thirdparty as Instance,
      active: (ref) => ({ ref, trust: "sandboxed", granted }),
      handlers: {
        list: async () => null,
        run: async () => null,
        data: async () => {
          throw new KiboError("QUOTA_EXCEEDED", "too big");
        },
        fetch: async () => {
          throw new KiboError("PERMISSION_DENIED", "private address");
        },
        action: async () => null,
        notes: async () => null,
        mcp: async () => null,
      },
      quotas: createQuotas(),
      events,
    });
    await refused(deny.call("p1", "thirdparty", { kind: "data.set", key: "k", value: 1 }), "QUOTA_EXCEEDED");
    await refused(
      deny.call("p1", "thirdparty", {
        kind: "fetch",
        url: "https://api.github.com/graphql",
        init: { method: "GET", headers: {} },
      }),
      "PERMISSION_DENIED",
    );
    expect(events.list().map((e) => e.code)).toEqual(["QUOTA_EXCEEDED", "PERMISSION_DENIED"]);
    expect(g).toBeDefined();
  });
});

test("missingPermission names what is lacking", () => {
  expect(missingPermission(granted, { kind: "list", entity: "status" })).toBe("read:status");
  expect(missingPermission(granted, { kind: "data.get", key: "k" })).toBeNull();
  expect(
    missingPermission(granted, {
      kind: "fetch",
      url: "https://api.github.com/graphql/x",
      init: { method: "GET", headers: {} },
    }),
  ).toBeNull();
});

test("reserved commands stay refused even with every write granted", () => {
  const everything: GrantedPermissions = { ...granted, writes: [...BuiltinEntityType.options] };
  const data: ComponentCall = {
    kind: "run",
    command: { method: "setInstanceData", instanceId: "thirdparty", key: "k", value: 1 },
  };
  const component: ComponentCall = {
    kind: "run",
    command: {
      method: "setInstanceComponent",
      instanceId: "thirdparty",
      component: "evil@0.2.0",
      config: {},
      data: null,
    },
  };
  expect(missingPermission(everything, data)).toBe("write:setInstanceData");
  expect(missingPermission(everything, component)).toBe("write:setInstanceComponent");
});

test("list(run) needs read:run and reaches the list handler", async () => {
  const { gate: g } = gate();
  await refused(g.call("p1", "thirdparty", { kind: "list", entity: "run" }), "PERMISSION_DENIED");
  const withRuns = createGate({
    instance: () => instances.thirdparty as Instance,
    active: (ref) => ({ ref, trust: "sandboxed", granted: { ...granted, reads: ["run"] } }),
    handlers: {
      list: async (_p, entity) => `list:${entity}`,
      run: async () => null,
      data: async () => null,
      fetch: async () => ({ status: 200, headers: {}, body: "" }),
      action: async () => null,
      notes: async () => null,
      mcp: async () => null,
    },
    quotas: createQuotas(),
    events: createEventLog(db),
  });
  expect(await withRuns.call("p1", "thirdparty", { kind: "list", entity: "run" })).toBe("list:run");
});

test("a journal failure never hides the refusal", async () => {
  const { gate: g } = gate();
  db.close();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  try {
    await refused(g.call("p1", "thirdparty", { kind: "list", entity: "link" }), "PERMISSION_DENIED");
    expect(logged).toHaveBeenCalledTimes(1);
  } finally {
    logged.mockRestore();
  }
});

test("NOT_FOUND is journaled only when the instance itself is missing", async () => {
  const { events } = gate();
  const missing = createGate({
    instance: () => instances.thirdparty as Instance,
    active: (ref) => ({ ref, trust: "sandboxed", granted }),
    handlers: {
      list: async () => {
        throw new KiboError("NOT_FOUND", "ticket t");
      },
      run: async () => null,
      data: async () => null,
      fetch: async () => ({ status: 200, headers: {}, body: "" }),
      action: async () => null,
      notes: async () => null,
      mcp: async () => null,
    },
    quotas: createQuotas(),
    events,
  });
  await refused(missing.call("p1", "thirdparty", { kind: "list", entity: "ticket" }), "NOT_FOUND");
  expect(events.list()).toEqual([]);
});

test("the granted secrets reach the fetch handler of a sandboxed component only", async () => {
  const seen: unknown[] = [];
  const secrets = [{ name: "github" as const, hosts: ["api.github.com"] }];
  const eventsDb = new Database(":memory:");
  ensureEventsTable(eventsDb);
  const g = createGate({
    instance: (_p, id) => {
      const i = instances[id];
      if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
      return i;
    },
    active: (ref) => ({ ref, trust: "sandboxed", granted: { ...granted, secrets } }),
    handlers: {
      list: async () => [],
      run: async () => null,
      data: async () => null,
      fetch: async (grant) => {
        seen.push(grant);
        return { status: 200, headers: {}, body: "" };
      },
      action: async () => null,
      notes: async () => null,
      mcp: async () => null,
    },
    quotas: createQuotas(),
    events: createEventLog(eventsDb, () => 42),
  });
  const call: ComponentCall = {
    kind: "fetch",
    url: "https://api.github.com/graphql",
    init: { method: "GET", headers: {} },
  };
  await g.call("p", "thirdparty", call);
  await g.call("p", "builtin", call);
  expect(seen).toEqual([{ net: ["api.github.com/graphql"], secrets }, null]);
});
