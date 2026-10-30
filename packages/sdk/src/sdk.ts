import {
  type CiRun,
  COMMAND_WRITES,
  type CommandResult,
  type ComponentCall,
  type ComponentManifest,
  type ComponentSettings,
  capPermission,
  type EntityType,
  type FetchInitInput,
  type FetchResponse,
  KiboError,
  type ProjectCommand,
  type ProjectEvent,
  type ProjectInfo,
  ruleCovers,
} from "@kibo/schema";
import { assetsApi, designApi } from "./capability-apis";
import { questionsApi } from "./questions-api";
import { ALWAYS_VISIBLE, NO_FOCUS, NO_SELECTION } from "./signal";
import { NO_SPOTLIGHT } from "./spotlight";
import { openSprintOf, sprintsApi } from "./sprints-api";
import { emitToast } from "./toast-bus";
import type { EntityMap, InstanceData, KiboSdk, ProjectBackend, SdkContext, SdkMode } from "./types";

type Guard = {
  deny(what: string): never;
  needRead(entity: EntityType): void;
  needWrite(entity: EntityType): void;
};
type Call = <T>(c: ComponentCall) => Promise<T>;

function guardFor(manifest: ComponentManifest): Guard {
  const deny = (what: string): never => {
    throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare ${what}`);
  };
  return {
    deny,
    needRead: (entity) => {
      if (!manifest.reads.includes(entity)) deny(`read ${entity}`);
    },
    needWrite: (entity) => {
      if (!manifest.writes.includes(entity)) deny(`write ${entity}`);
    },
  };
}

function instanceData(manifest: ComponentManifest, guard: Guard, call: Call): InstanceData {
  const needData = () => {
    if (!manifest.data) guard.deny("data");
  };
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      needData();
      return call<T | undefined>({ kind: "data.get", key });
    },
    async set(key, value) {
      needData();
      await call({ kind: "data.set", key, value });
    },
    async delete(key) {
      needData();
      await call({ kind: "data.delete", key });
    },
    async keys() {
      needData();
      return call<string[]>({ kind: "data.keys" });
    },
  };
}

export function createSdk(
  backend: ProjectBackend,
  manifest: ComponentManifest,
  ctx: SdkContext,
  mode: SdkMode = "builtin",
): KiboSdk {
  const guard = guardFor(manifest);
  const call: Call = async <T>(c: ComponentCall) => (await backend.call(c)) as T;
  const fromSnapshot = <T extends EntityType>(type: T): Promise<EntityMap[T][]> => {
    const loaders: { [K in EntityType]: () => Promise<EntityMap[K][]> } = {
      ticket: async () => (await backend.snapshot()).tickets,
      status: async () => (await backend.snapshot()).workflow,
      link: async () => (await backend.snapshot()).links,
      page: async () => (await backend.snapshot()).pages,
      ci_run: () => call<CiRun[]>({ kind: "list", entity: "ci_run" }),
      question: async () => (await backend.snapshot()).questions,
      sprint: async () => (await backend.snapshot()).sprints,
      project_event: () => call<ProjectEvent[]>({ kind: "list", entity: "project_event" }),
    };
    return loaders[type]();
  };

  const sdk: KiboSdk = {
    ...ctx,
    openNewTicket: (d) => ctx.openNewTicket({ ...d, instanceId: ctx.instanceId }),
    toast: emitToast,
    async list<T extends EntityType>(type: T): Promise<EntityMap[T][]> {
      guard.needRead(type);
      return mode === "gated" ? call<EntityMap[T][]>({ kind: "list", entity: type }) : fromSnapshot(type);
    },
    async run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]> {
      const entity = COMMAND_WRITES[cmd.method];
      if (entity === null) guard.deny(`write ${cmd.method}`);
      else guard.needWrite(entity);
      const result =
        mode === "gated" ? await backend.call({ kind: "run", command: cmd }) : await backend.run(cmd);
      return result as CommandResult[C["method"]];
    },
    subscribe: (listener) => backend.subscribe(listener),
    data: instanceData(manifest, guard, call),
    async fetch(url: string, init: FetchInitInput = {}): Promise<FetchResponse> {
      if (!manifest.net.some((rule) => ruleCovers(rule, url))) guard.deny(`net ${url}`);
      return call<FetchResponse>({
        kind: "fetch",
        url,
        init: {
          method: init.method ?? "GET",
          headers: init.headers ?? {},
          ...(init.body !== undefined && { body: init.body }),
        },
      });
    },
    async action<T = unknown>(name: string, input?: unknown): Promise<T> {
      return call<T>({ kind: "action", name, input: input ?? null });
    },
    async setConfig(patch) {
      await call({ kind: "config.set", patch });
    },
    settings: {
      async get() {
        guard.needRead("ticket");
        return call<ComponentSettings>({ kind: "settings.get" });
      },
      subscribe(listener) {
        const offProject = backend.subscribe(listener);
        const offConfig = backend.subscribeConfig?.(listener);
        return () => {
          offProject();
          offConfig?.();
        };
      },
    },
    capabilities: [...manifest.capabilities],
    capability(name) {
      if (!manifest.capabilities.includes(name)) guard.deny(capPermission(name));
    },
    assets: assetsApi(manifest, guard, call),
    design: designApi(manifest, guard, call),
    questions: questionsApi({ read: guard.needRead, write: guard.needWrite }, call, backend, mode),
    sprints: sprintsApi({
      list: (type) => sdk.list(type),
      run: (cmd) => sdk.run(cmd),
      open: openSprintOf(ctx),
    }),
    project: {
      async get() {
        guard.needRead("ticket");
        return call<ProjectInfo>({ kind: "project.get" });
      },
      subscribe: (listener) => backend.subscribe(listener),
      edit: (request) => {
        if (ctx.editProject) ctx.editProject(request);
        else console.warn(`[kibo-sdk] ${ctx.instanceId}: no host to edit the project`);
      },
    },
    focus: ctx.focus ?? NO_FOCUS,
    visibility: ctx.visibility ?? ALWAYS_VISIBLE,
    selection: ctx.selection ?? NO_SELECTION,
    spotlight: ctx.spotlight ?? NO_SPOTLIGHT,
  };
  return sdk;
}
