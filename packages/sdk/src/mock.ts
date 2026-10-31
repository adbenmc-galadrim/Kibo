import { createProjectDoc, executeProjectCommand, readProject, UNDATED } from "@kibo/core";
import {
  ComponentManifest,
  type ComponentManifestInput,
  capPermission,
  defaultFormatOf,
  type EntityType,
  KiboError,
  NO_ACTIVITY,
  type ProjectCommand,
  type ProjectEditRequest,
  permissionOfCall,
  type Selection,
} from "@kibo/schema";
import { actAs } from "./mock-actor";
import { createMockCalls } from "./mock-calls";
import { recordedFrameApis } from "./mock-embed";
import { applyMockHolds } from "./mock-holds";
import { createNotifier } from "./mock-notifier";
import { recordedTrackingApis } from "./mock-project";
import { recordedAgentApis } from "./mock-recorded";
import { createMockSettings } from "./mock-settings";
import type { MockSdk, MockSdkOptions } from "./mock-types";
import { createSdk } from "./sdk";
import { createSignal, focusApi, selectionApi, visibilityApi } from "./signal";
import { createSpotlightStore } from "./spotlight";
import type { EntityMap, FileTarget, KiboSdk, NewTicketDefaults, ProjectBackend } from "./types";

export type { MockFrame } from "./mock-design";
export type { MockT3 } from "./mock-t3";
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
    delivery: null,
    tracking: opts.tracking ?? null,
    description: opts.description ?? null,
    client: opts.client ?? null,
  });
  const changes = createNotifier();
  const run = (cmd: ProjectCommand) => {
    const result = executeProjectCommand(doc, cmd);
    changes.emit();
    return result;
  };
  const viewer = opts.viewer ?? "adam";
  const componentRun = (cmd: ProjectCommand) => run(actAs(cmd, viewer));
  opts.seed?.(run);
  applyMockHolds(doc, run, opts.holds ?? []);
  const data = new Map<string, unknown>();
  const configPatches: Record<string, unknown>[] = [];
  const violations: string[] = [];
  const used: string[] = [];
  const opened: string[] = [];
  const newTicketRequests: NewTicketDefaults[] = [];
  const openedFiles: FileTarget[] = [];
  const openedViews: string[] = [];
  const viewRequests: MockSdk["viewRequests"] = [];
  const openedSprints: string[] = [];
  const projectEdits: ProjectEditRequest[] = [];
  const toasts: string[] = [];
  const focusRequests: boolean[] = [];
  const selections: (Selection | null)[] = [];
  const focus = createSignal(opts.focus ?? false);
  const visible = createSignal(opts.visible ?? true);
  const selection = createSignal<Selection | null>(opts.selection ?? null);
  const spotlight = createSpotlightStore(opts.spotlight ?? null);
  const settings = createMockSettings(doc, changes.emit);
  const today = opts.today ?? UNDATED;

  const backend: ProjectBackend = {
    snapshot: async () => readProject(doc, today, NO_ACTIVITY),
    run: async (cmd) => componentRun(cmd),
    call: createMockCalls({
      ...opts,
      today,
      doc,
      run: componentRun,
      data,
      manifest,
      configPatches,
      settings: () => settings.read(),
    }),
    subscribe: changes.subscribe,
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
      const intent = viewOpts?.intent;
      viewRequests.push({ componentId, question: viewOpts?.question ?? null, ...(intent && { intent }) });
    },
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
    openedSprints,
    projectEdits,
    toasts,
    data,
    configPatches,
    run,
    snapshot: () => readProject(doc, today, NO_ACTIVITY),
    setTracking: settings.setTracking,
    focusRequests,
    selections,
    setVisible: visible.set,
    setFocus: focus.set,
    setSelection: selection.set,
    setSpotlight: spotlight.set,
  };
}
