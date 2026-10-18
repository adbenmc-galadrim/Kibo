import {
  createProjectDoc,
  enableServerAllocation,
  executeProjectCommand,
  readProject,
  UNDATED,
} from "@kibo/core";
import {
  ComponentManifest,
  type ComponentManifestInput,
  capPermission,
  defaultFormatOf,
  type EntityType,
  KiboError,
  type ProjectAccess,
  type ProjectCommand,
  type ProjectEditRequest,
  permissionOfCall,
  type Selection,
} from "@kibo/schema";
import { actAs } from "./mock-actor";
import { createMockCalls } from "./mock-calls";
import { createMockRunDelivery, MOCK_DELIVERY_AGENT_INFO } from "./mock-delivery";
import { createMockEmbeds, recordedFrameApis } from "./mock-embed";
import { createMockNotes } from "./mock-notes";
import { createNotifier } from "./mock-notifier";
import { recordedTrackingApis } from "./mock-project";
import { createMockDelivery } from "./mock-questions";
import { recordedAgentApis } from "./mock-recorded";
import { activityOf, createMockRuns } from "./mock-runs";
import { createMockSettings } from "./mock-settings";
import type { MockSdk, MockSdkOptions } from "./mock-types";
import { createSdk } from "./sdk";
import type { ServerContext } from "./server";
import { createSignal, focusApi, selectionApi, visibilityApi } from "./signal";
import { createSpotlightStore } from "./spotlight";
import type { EntityMap, FileTarget, KiboSdk, NewTicketDefaults, ProjectBackend } from "./types";

export type { MockFetch } from "./mock-calls";
export type { MockFrame } from "./mock-design";
export type { MockEmbedOptions } from "./mock-embed";
export type { MockNote } from "./mock-notes";
export type { MockSdk, MockSdkOptions } from "./mock-types";

const PROJECT_KEY = "KIB";

export function createMockSdk(
  manifestInput: ComponentManifest | ComponentManifestInput,
  opts: MockSdkOptions = {},
): MockSdk {
  const manifest = ComponentManifest.parse(manifestInput);
  const doc = createProjectDoc({
    id: "mock",
    key: PROJECT_KEY,
    name: "Mock",
    folder: opts.folder ?? null,
    color: "#71717A",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: opts.tracking ?? null,
    description: opts.description ?? null,
    client: opts.client ?? null,
  });
  const changes = createNotifier();
  const runChanges = createNotifier();
  const presenceChanges = createNotifier();
  let access: ProjectAccess = "write";
  let peers = opts.presence ?? [];
  if (opts.shared) enableServerAllocation(doc);
  const run = (cmd: ProjectCommand) => {
    const result = executeProjectCommand(doc, cmd);
    changes.emit();
    return result;
  };
  const viewer = opts.viewer ?? "adam";
  const componentRun = (cmd: ProjectCommand) => run(actAs(cmd, viewer));
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
  const viewRequests: MockSdk["viewRequests"] = [];
  const deliveries: string[] = [];
  const openedSprints: string[] = [];
  const projectEdits: ProjectEditRequest[] = [];
  const toasts: string[] = [];
  const embeds = createMockEmbeds(manifest.embeds, opts.embed);
  const focusRequests: boolean[] = [];
  const selections: (Selection | null)[] = [];
  const focus = createSignal(opts.focus ?? false);
  const visible = createSignal(opts.visible ?? true);
  const selection = createSignal<Selection | null>(opts.selection ?? null);
  const spotlight = createSpotlightStore(opts.spotlight ?? null);
  const settings = createMockSettings(doc, opts.agentExecution ?? "hidden", changes.emit);
  const mockRuns = createMockRuns(opts.peeks ?? {});
  const today = opts.today ?? UNDATED;
  const runDelivery = createMockRunDelivery({
    doc,
    today,
    runs: () => runs,
    denials: opts.denials ?? {},
    agent: opts.deliveryAgent === undefined ? MOCK_DELIVERY_AGENT_INFO : opts.deliveryAgent,
  });

  const serverContext = (): ServerContext => ({
    instanceId: sdk.instanceId,
    config: sdk.config,
    list: sdk.list,
    run: sdk.run,
    data: sdk.data,
    fetch: sdk.fetch,
  });

  const backend: ProjectBackend = {
    snapshot: async () => readProject(doc, today, activityOf(runs)),
    run: async (cmd) => componentRun(cmd),
    call: createMockCalls({
      ...opts,
      today,
      doc,
      run: componentRun,
      data,
      manifest,
      configPatches,
      folder,
      runs: () => runs,
      peers: () => peers,
      access: () => access,
      serverContext,
      embeds,
      peek: mockRuns.peek,
      settings: () => settings.read(),
      delivery: runDelivery,
      deliver: createMockDelivery({
        doc,
        refused: opts.deliveryRefused ?? false,
        deliveries,
        changed: changes.emit,
      }),
    }),
    subscribe: changes.subscribe,
    runs: async () => runs,
    subscribeRuns: runChanges.subscribe,
    subscribePresence: presenceChanges.subscribe,
    subscribeConfig: (listener) => settings.subscribe(listener),
  };

  const inner = createSdk(backend, manifest, {
    instanceId: "mock-instance",
    config: opts.config ?? {},
    viewer,
    surface: opts.surface ?? (manifest.kind === "view" ? "view" : "widget"),
    format: opts.format ?? defaultFormatOf(manifest),
    openTicket: (id) => opened.push(id),
    openNewTicket: (d) => newTicketRequests.push(d),
    openFile: (target) => openedFiles.push(target),
    openView: (componentId, viewOpts) => {
      openedViews.push(componentId);
      viewRequests.push({ componentId, question: viewOpts?.question ?? null });
    },
    openRun: mockRuns.open,
    openSprint: (sprintId) => openedSprints.push(sprintId),
    editProject: (request) => projectEdits.push(request),
    focus: focusApi(focus, (on) => focusRequests.push(on)),
    visibility: visibilityApi(visible),
    selection: selectionApi(selection, (next) => selections.push(next)),
    spotlight,
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
    toast: (message) => void toasts.push(message),
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
    ...recordedFrameApis(inner, record),
    ...recordedAgentApis(inner, record),
    ...recordedTrackingApis(inner, record, () => sdk),
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
    viewRequests,
    openedRuns: mockRuns.opened,
    openedSprints,
    projectEdits,
    toasts,
    deliveries,
    runDeliveries: runDelivery.delivered,
    allowed: runDelivery.allowed,
    embedCalls: embeds.calls,
    data,
    configPatches,
    notes: folder.notes,
    run,
    snapshot: () => readProject(doc, today, activityOf(runs)),
    setRuns: (next) => {
      runs = next;
      runChanges.emit();
      changes.emit();
    },
    touchNote: folder.touch,
    setAccess: (next) => {
      access = next;
      changes.emit();
    },
    setTracking: settings.setTracking,
    setAgentExecution: settings.setAgentExecution,
    setPresence: (next) => {
      peers = next;
      presenceChanges.emit();
    },
    focusRequests,
    selections,
    setVisible: visible.set,
    setFocus: focus.set,
    setSelection: selection.set,
    setSpotlight: spotlight.set,
  };
}
