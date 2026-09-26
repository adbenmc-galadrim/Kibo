import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import {
  type ComponentCall,
  ComponentManifest,
  type ComponentManifestInput,
  type EntityType,
  type FetchInit,
  type FetchResponse,
  KiboError,
  type ProjectCommand,
  type ProjectSnapshot,
  permissionOfCall,
  type Surface,
  type TicketRun,
} from "@kibo/schema";
import { createMockNotes, type MockNote } from "./mock-notes";
import { createSdk } from "./sdk";
import type { ServerContext, ServerDefinition } from "./server";
import type { EntityMap, FileTarget, KiboSdk, NewTicketDefaults } from "./types";

export type { MockNote } from "./mock-notes";
export type MockFetch = (url: string, init: FetchInit) => FetchResponse | Promise<FetchResponse>;
export type MockSdk = {
  sdk: KiboSdk;
  violations: string[];
  used: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileTarget[];
  openedViews: string[];
  data: Map<string, unknown>;
  notes: Map<string, MockNote>;
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
  setRuns(runs: TicketRun[]): void;
  touchNote(path: string, markdown: string): void;
};
export type MockSdkOptions = {
  seed?: (run: (cmd: ProjectCommand) => unknown) => void;
  viewer?: string;
  config?: Record<string, unknown>;
  surface?: Surface;
  runs?: TicketRun[];
  fetch?: MockFetch;
  server?: ServerDefinition;
  notes?: Record<string, string>;
  noteAges?: Record<string, number>;
};

const PROJECT_KEY = "KIB";

const notifier = () => {
  const listeners = new Set<() => void>();
  return {
    emit: () => {
      for (const l of listeners) l();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
};

export function createMockSdk(
  manifestInput: ComponentManifest | ComponentManifestInput,
  opts: MockSdkOptions = {},
): MockSdk {
  const manifest = ComponentManifest.parse(manifestInput);
  const doc = createProjectDoc({
    id: "mock",
    key: PROJECT_KEY,
    name: "Mock",
    folder: null,
    color: "#71717A",
  });
  const changes = notifier();
  const runChanges = notifier();
  const run = (cmd: ProjectCommand) => {
    const result = executeProjectCommand(doc, cmd);
    changes.emit();
    return result;
  };
  opts.seed?.(run);
  let runs = opts.runs ?? [];
  const folder = createMockNotes(opts.notes ?? {}, opts.noteAges ?? {}, PROJECT_KEY, changes.emit);
  const data = new Map<string, unknown>();
  const violations: string[] = [];
  const used: string[] = [];
  const opened: string[] = [];
  const newTicketRequests: NewTicketDefaults[] = [];
  const openedFiles: FileTarget[] = [];
  const openedViews: string[] = [];

  const listEntity = (entity: EntityType): unknown[] => {
    const snapshot = readProject(doc);
    const lists: { [K in EntityType]: () => EntityMap[K][] } = {
      ticket: () => snapshot.tickets,
      status: () => snapshot.workflow,
      link: () => snapshot.links,
      page: () => snapshot.pages,
      run: () => runs,
      note: () => folder.list(),
    };
    return lists[entity]();
  };

  const serverContext = (): ServerContext => ({
    instanceId: sdk.instanceId,
    config: sdk.config,
    list: sdk.list,
    run: sdk.run,
    data: sdk.data,
    fetch: sdk.fetch,
  });

  const handle = async (c: ComponentCall): Promise<unknown> => {
    switch (c.kind) {
      case "list":
        return listEntity(c.entity);
      case "run":
        return run(c.command);
      case "data.get":
        return structuredClone(data.get(c.key));
      case "data.set":
        data.set(c.key, structuredClone(c.value));
        return null;
      case "data.delete":
        data.delete(c.key);
        return null;
      case "data.keys":
        return [...data.keys()];
      case "fetch":
        if (!opts.fetch) throw new KiboError("NOT_FOUND", `no response programmed for ${c.url}`);
        return opts.fetch(c.url, c.init);
      case "action": {
        const action = opts.server?.actions?.[c.name];
        if (!action) throw new KiboError("PERMISSION_DENIED", `unknown action ${c.name}`);
        return action(serverContext(), c.input);
      }
      case "notes.read":
        return folder.read(c.path);
      case "notes.write":
        return folder.write(c.path, c.markdown, c.expectedMtime);
      case "notes.rename":
        return folder.rename(c.from, c.to);
      case "notes.remove":
        folder.remove(c.path);
        return null;
      case "notes.search":
        return folder.search(c.query);
      case "notes.info":
        return folder.info();
    }
  };

  const inner = createSdk(
    {
      snapshot: async () => readProject(doc),
      run: async (cmd) => run(cmd),
      call: handle,
      subscribe: changes.subscribe,
      runs: async () => runs,
      subscribeRuns: runChanges.subscribe,
    },
    manifest,
    {
      instanceId: "mock-instance",
      config: opts.config ?? {},
      viewer: opts.viewer ?? "adam",
      surface: opts.surface ?? (manifest.kind === "view" ? "view" : "widget"),
      openTicket: (id) => opened.push(id),
      openNewTicket: (d) => newTicketRequests.push(d),
      openFile: (target) => openedFiles.push(target),
      openView: (componentId) => openedViews.push(componentId),
    },
  );

  const record = async <T>(permission: string | null, label: string, work: () => Promise<T>): Promise<T> => {
    if (permission !== null && !used.includes(permission)) used.push(permission);
    try {
      return await work();
    } catch (e) {
      if (e instanceof KiboError && e.code === "PERMISSION_DENIED") violations.push(label);
      throw e;
    }
  };
  const readNote = <T>(work: () => Promise<T>) => record("read:note", "read note", work);
  const writeNote = <T>(work: () => Promise<T>) => record("write:note", "write note", work);
  const useData = <T>(work: () => Promise<T>) => record("data", "data", work);

  const sdk: KiboSdk = {
    ...inner,
    list: <T extends EntityType>(type: T): Promise<EntityMap[T][]> =>
      record(`read:${type}`, `read ${type}`, () => inner.list(type)),
    run: (cmd) =>
      record(permissionOfCall({ kind: "run", command: cmd }), `write ${cmd.method}`, () => inner.run(cmd)),
    data: {
      get: <T>(key: string) => useData(() => inner.data.get<T>(key)),
      set: (key, value) => useData(() => inner.data.set(key, value)),
      delete: (key) => useData(() => inner.data.delete(key)),
      keys: () => useData(() => inner.data.keys()),
    },
    fetch: (url, init) => record(`net:${url}`, `net ${url}`, () => inner.fetch(url, init)),
    action: <T>(name: string, input?: unknown) =>
      record(null, `action ${name}`, () => inner.action<T>(name, input)),
    notes: {
      read: (path) => readNote(() => inner.notes.read(path)),
      search: (query) => readNote(() => inner.notes.search(query)),
      info: () => readNote(() => inner.notes.info()),
      write: (path, markdown, expectedMtime) =>
        writeNote(() => inner.notes.write(path, markdown, expectedMtime)),
      rename: (from, to) => writeNote(() => inner.notes.rename(from, to)),
      remove: (path) => writeNote(() => inner.notes.remove(path)),
    },
  };

  return {
    sdk,
    violations,
    used,
    opened,
    newTicketRequests,
    openedFiles,
    openedViews,
    data,
    notes: folder.notes,
    run,
    snapshot: () => readProject(doc),
    setRuns: (next) => {
      runs = next;
      runChanges.emit();
    },
    touchNote: folder.touch,
  };
}
