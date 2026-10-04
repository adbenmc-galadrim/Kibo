import { Database } from "bun:sqlite";
import { expect } from "bun:test";
import { type GrantedPermissions, type Instance, KiboError } from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate, type GateHandlers } from "./gate";
import { createQuotas, type Quotas } from "./quotas";

export const granted: GrantedPermissions = {
  reads: ["ticket"],
  writes: [],
  data: true,
  net: ["api.github.com/graphql"],
  secrets: [],
  mcp: [],
  capabilities: [],
};
export const instances: Record<string, Instance> = {
  thirdparty: {
    id: "thirdparty",
    pageId: "pg",
    component: "evil@0.1.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
    componentHash: null,
  },
  builtin: {
    id: "builtin",
    pageId: "pg",
    component: "notes@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
    componentHash: null,
  },
  untrusted: {
    id: "untrusted",
    pageId: "pg",
    component: "pending@0.1.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
    componentHash: null,
  },
};

export const idleHandlers: GateHandlers = {
  list: async () => null,
  run: async () => null,
  data: async () => null,
  fetch: async () => ({ status: 200, headers: {}, body: "" }),
  action: async () => null,
  notes: async () => null,
  mcp: async () => null,
  assets: async () => null,
  design: async () => null,
  presence: async () => [],
  sharing: async () => {
    throw new KiboError("INTERNAL", "unexpected");
  },
};

export const findInstance = (_p: string, id: string): Instance => {
  const i = instances[id];
  if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
  return i;
};

export function eventsDb(): Database {
  const db = new Database(":memory:");
  ensureEventsTable(db);
  return db;
}

export function testGate(quotas: Quotas = createQuotas(), grantedToEvil: GrantedPermissions = granted) {
  const db = eventsDb();
  const events = createEventLog(db, () => 42);
  const handled: string[] = [];
  const handler = (name: string) => async () => {
    handled.push(name);
    return name;
  };
  const gate = createGate({
    instance: findInstance,
    active: (ref) => {
      if (ref === "evil@0.1.0") return { ref, trust: "sandboxed", granted: grantedToEvil };
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
      assets: async (_projectId, instanceId, call) => {
        handled.push(`assets:${instanceId}:${call.kind}`);
        return null;
      },
      design: async (_projectId, instanceId, call) => {
        handled.push(`design:${instanceId}:${call.kind}`);
        return null;
      },
      presence: async () => {
        handled.push("presence");
        return [];
      },
      sharing: async () => {
        throw new KiboError("INTERNAL", "unexpected");
      },
    },
    quotas,
    events,
  });
  return { gate, events, handled, db };
}

export const refused = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toThrow(code);
};
