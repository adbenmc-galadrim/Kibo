import { Database } from "bun:sqlite";
import { expect } from "bun:test";
import { DEFAULT_COMPONENT_SETTINGS, type Instance, KiboError } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import type { FilesService } from "../files/service";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate, type GateHandlers } from "./gate";
import type { GateHandlersDeps } from "./gate-handlers";
import { createQuotas, type Quotas } from "./quotas";

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
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
    componentHash: null,
  },
};

export const unused = (): never => {
  throw new Error("unused in this test");
};
export const stubDocs: Docs = {
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
  projectMeta: unused,
  updateProjectMeta: unused,
  identity: unused,
  activity: unused,
  today: unused,
};
export const stubFiles: FilesService = {
  dirOf: unused,
  info: unused,
  setDir: unused,
  list: unused,
  remove: unused,
  uploads: { begin: unused, append: unused, finish: unused, cancel: unused, close: unused },
  url: unused,
  open: unused,
  close: unused,
};
export const stubHandlerDeps: GateHandlersDeps = {
  docs: stubDocs,
  files: stubFiles,
  runs: unused,
  manifestOf: unused,
};

export const idleHandlers: GateHandlers = {
  list: async () => null,
  run: async () => null,
  data: async () => null,
  fetch: async () => ({ status: 200, headers: {}, body: "" }),
  mcp: async () => null,
  assets: async () => null,
  design: async () => null,
  embed: async () => null,
  config: async () => null,
  settings: async () => DEFAULT_COMPONENT_SETTINGS,
  project: async () => {
    throw new KiboError("INTERNAL", "unexpected");
  },
  recipients: async () => [],
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

export function testGate(quotas: Quotas = createQuotas()) {
  const db = eventsDb();
  const events = createEventLog(db, () => 42);
  const handled: string[] = [];
  const handler = (name: string) => async () => {
    handled.push(name);
    return name;
  };
  const gate = createGate({
    instance: findInstance,
    handlers: {
      list: handler("list"),
      run: handler("run"),
      data: handler("data"),
      fetch: async (url) => {
        handled.push(`fetch:${url}`);
        return { status: 200, headers: {}, body: "" };
      },
      mcp: handler("mcp"),
      assets: async (_projectId, instanceId, call) => {
        handled.push(`assets:${instanceId}:${call.kind}`);
        return null;
      },
      design: async (_projectId, instanceId, call) => {
        handled.push(`design:${instanceId}:${call.kind}`);
        return null;
      },
      embed: async (_projectId, instance, url) => {
        handled.push(`embed:${instance.id}:${url}`);
        return null;
      },
      config: async (_projectId, instance, patch) => {
        handled.push(`config:${instance.id}:${Object.keys(patch).join(",")}`);
        return null;
      },
      settings: async () => DEFAULT_COMPONENT_SETTINGS,
      project: async () => {
        throw new KiboError("INTERNAL", "unexpected");
      },
      recipients: async (projectId) => {
        handled.push(`recipients:${projectId}`);
        return [{ id: "me", name: "Moi" }];
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
