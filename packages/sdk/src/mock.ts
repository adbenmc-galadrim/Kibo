import { createProjectDoc, enableServerAllocation, executeProjectCommand, readProject } from "@kibo/core";
import {
  type CiRun,
  type ComponentFormat,
  ComponentManifest,
  type ComponentManifestInput,
  capPermission,
  defaultFormatOf,
  type EntityType,
  KiboError,
  type McpCallResult,
  type MemberInfo,
  type PresencePeer,
  type ProjectAccess,
  type ProjectAsset,
  type ProjectCommand,
  type ProjectSnapshot,
  permissionOfCall,
  type Selection,
  type Surface,
  type TicketRun,
} from "@kibo/schema";
import { createMockCalls, type MockFetch } from "./mock-calls";
import type { MockFrame } from "./mock-design";
import { createMockNotes, type MockNote } from "./mock-notes";
import { createSdk } from "./sdk";
import type { ServerContext, ServerDefinition } from "./server";
import { createSignal, focusApi, selectionApi, visibilityApi } from "./signal";
import type { EntityMap, FileTarget, KiboSdk, NewTicketDefaults, ProjectBackend } from "./types";

export type { MockFetch } from "./mock-calls";
export type { MockFrame } from "./mock-design";
export type { MockNote } from "./mock-notes";
export type MockSdk = {
  sdk: KiboSdk;
  backend: ProjectBackend;
  violations: string[];
  used: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileTarget[];
  openedViews: string[];
  data: Map<string, unknown>;
  configPatches: Record<string, unknown>[];
  notes: Map<string, MockNote>;
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
  setRuns(runs: TicketRun[]): void;
  touchNote(path: string, markdown: string): void;
  setAccess(access: ProjectAccess): void;
  setPresence(peers: PresencePeer[]): void;
  focusRequests: boolean[];
  selections: (Selection | null)[];
  setVisible(visible: boolean): void;
  setFocus(active: boolean): void;
  setSelection(selection: Selection | null): void;
};
export type MockSdkOptions = {
  seed?: (run: (cmd: ProjectCommand) => unknown) => void;
  viewer?: string;
  config?: Record<string, unknown>;
  surface?: Surface;
  format?: ComponentFormat;
  runs?: TicketRun[];
  fetch?: MockFetch;
  server?: ServerDefinition;
  notes?: Record<string, string>;
  noteAges?: Record<string, number>;
  mcp?: Record<string, McpCallResult>;
  ciRuns?: CiRun[];
  presence?: PresencePeer[];
  shared?: boolean;
  members?: MemberInfo[];
  assets?: ProjectAsset[];
  frames?: MockFrame[];
  visible?: boolean;
  focus?: boolean;
  selection?: Selection | null;
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
  const presenceChanges = notifier();
  let access: ProjectAccess = "write";
  let peers = opts.presence ?? [];
  if (opts.shared) enableServerAllocation(doc);
  const run = (cmd: ProjectCommand) => {
    const result = executeProjectCommand(doc, cmd);
    changes.emit();
    return result;
  };
  opts.seed?.(run);
  let runs = opts.runs ?? [];
  const folder = createMockNotes(opts.notes ?? {}, opts.noteAges ?? {}, PROJECT_KEY, changes.emit);
  const data = new Map<string, unknown>();
  const configPatches: Record<string, unknown>[] = [];
  const violations: string[] = [];
  const used: string[] = [];
  const opened: string[] = [];
  const newTicketRequests: NewTicketDefaults[] = [];
  const openedFiles: FileTarget[] = [];
  const openedViews: string[] = [];
  const focusRequests: boolean[] = [];
  const selections: (Selection | null)[] = [];
  const focus = createSignal(opts.focus ?? false);
  const visible = createSignal(opts.visible ?? true);
  const selection = createSignal<Selection | null>(opts.selection ?? null);

  const serverContext = (): ServerContext => ({
    instanceId: sdk.instanceId,
    config: sdk.config,
    list: sdk.list,
    run: sdk.run,
    data: sdk.data,
    fetch: sdk.fetch,
  });

  const backend: ProjectBackend = {
    snapshot: async () => readProject(doc),
    run: async (cmd) => run(cmd),
    call: createMockCalls({
      ...opts,
      doc,
      run,
      data,
      manifest,
      configPatches,
      folder,
      runs: () => runs,
      peers: () => peers,
      access: () => access,
      serverContext,
    }),
    subscribe: changes.subscribe,
    runs: async () => runs,
    subscribeRuns: runChanges.subscribe,
    subscribePresence: presenceChanges.subscribe,
  };

  const inner = createSdk(backend, manifest, {
    instanceId: "mock-instance",
    config: opts.config ?? {},
    viewer: opts.viewer ?? "adam",
    surface: opts.surface ?? (manifest.kind === "view" ? "view" : "widget"),
    format: opts.format ?? defaultFormatOf(manifest),
    openTicket: (id) => opened.push(id),
    openNewTicket: (d) => newTicketRequests.push(d),
    openFile: (target) => openedFiles.push(target),
    openView: (componentId) => openedViews.push(componentId),
    focus: focusApi(focus, (on) => focusRequests.push(on)),
    visibility: visibilityApi(visible),
    selection: selectionApi(selection, (next) => selections.push(next)),
  });

  const markUsed = (permission: string) => {
    if (!used.includes(permission)) used.push(permission);
  };
  const record = async <T>(permission: string | null, label: string, work: () => Promise<T>): Promise<T> => {
    if (permission !== null) markUsed(permission);
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
  const useAssets = <T>(work: () => Promise<T>) => record(capPermission("assets"), "cap:assets", work);

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
      create: (path, markdown) => writeNote(() => inner.notes.create(path, markdown)),
      rename: (from, to) => writeNote(() => inner.notes.rename(from, to)),
      remove: (path) => writeNote(() => inner.notes.remove(path)),
      attach: (notePath, name, mime, bytes) =>
        writeNote(() => inner.notes.attach(notePath, name, mime, bytes)),
      asset: (path) => readNote(() => inner.notes.asset(path)),
    },
    mcp: {
      call: (server, tool, args) =>
        record(`mcp:${server}/${tool}`, `mcp ${server}/${tool}`, () => inner.mcp.call(server, tool, args)),
      read: (server, uri) => record(`mcp:${server}`, `mcp ${server}`, () => inner.mcp.read(server, uri)),
      importItem: (server, item) => {
        markUsed("write:ticket");
        return record(`mcp:${server}`, `mcp ${server}`, () => inner.mcp.importItem(server, item));
      },
    },
    presence: {
      list: () => record("read:ticket", "read presence", () => inner.presence.list()),
      subscribe: inner.presence.subscribe,
    },
    sharing: () => record("read:ticket", "read sharing", () => inner.sharing()),
    capability: (name) => {
      const permission = capPermission(name);
      markUsed(permission);
      try {
        inner.capability(name);
      } catch (e) {
        if (e instanceof KiboError && e.code === "PERMISSION_DENIED") violations.push(permission);
        throw e;
      }
    },
    assets: {
      list: () => useAssets(() => inner.assets.list()),
      url: (name) => useAssets(() => inner.assets.url(name)),
    },
    design: {
      frame: (url, opts) =>
        record(capPermission("design"), "cap:design", () => inner.design.frame(url, opts)),
    },
  };

  return {
    sdk,
    backend,
    violations,
    used,
    opened,
    newTicketRequests,
    openedFiles,
    openedViews,
    data,
    configPatches,
    notes: folder.notes,
    run,
    snapshot: () => readProject(doc),
    setRuns: (next) => {
      runs = next;
      runChanges.emit();
    },
    touchNote: folder.touch,
    setAccess: (next) => {
      access = next;
      changes.emit();
    },
    setPresence: (next) => {
      peers = next;
      presenceChanges.emit();
    },
    focusRequests,
    selections,
    setVisible: visible.set,
    setFocus: focus.set,
    setSelection: selection.set,
  };
}
