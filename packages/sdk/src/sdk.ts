import {
  type CiRun,
  COMMAND_WRITES,
  type CommandResult,
  type ComponentCall,
  type ComponentManifest,
  type EntityType,
  type FetchInitInput,
  type FetchResponse,
  KiboError,
  type McpCallResult,
  mcpCovered,
  type NoteContent,
  type NoteMeta,
  type NotesInfo,
  type ProjectCommand,
  ruleCovers,
  type Ticket,
} from "@kibo/schema";
import type {
  EntityMap,
  InstanceData,
  KiboSdk,
  McpApi,
  NotesApi,
  ProjectBackend,
  SdkContext,
  SdkMode,
} from "./types";

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

function notesApi(guard: Guard, call: Call): NotesApi {
  return {
    async read(path) {
      guard.needRead("note");
      return call<NoteContent>({ kind: "notes.read", path });
    },
    async write(path, markdown, expectedMtime) {
      guard.needWrite("note");
      return call<NoteMeta>({ kind: "notes.write", path, markdown, expectedMtime });
    },
    async rename(from, to) {
      guard.needWrite("note");
      return call<NoteMeta>({ kind: "notes.rename", from, to });
    },
    async remove(path) {
      guard.needWrite("note");
      await call({ kind: "notes.remove", path });
    },
    async search(query) {
      guard.needRead("note");
      return call<NoteMeta[]>({ kind: "notes.search", query });
    },
    async info() {
      guard.needRead("note");
      return call<NotesInfo>({ kind: "notes.info" });
    },
  };
}

function mcpApi(
  manifest: ComponentManifest,
  guard: Guard,
  call: Call,
  config: Record<string, unknown>,
): McpApi {
  const need = (server: string, tool: string | null) => {
    if (!mcpCovered(manifest.mcp, server, tool, config))
      guard.deny(`mcp ${tool === null ? server : `${server}/${tool}`}`);
  };
  return {
    async call(server, tool, args = {}) {
      need(server, tool);
      return call<McpCallResult>({ kind: "mcp.call", server, tool, args });
    },
    async read(server, uri) {
      need(server, null);
      return call<McpCallResult>({ kind: "mcp.read", server, uri });
    },
    async importItem(server, item) {
      guard.needWrite("ticket");
      need(server, null);
      return call<Ticket>({ kind: "mcp.import", server, item });
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
      run: () => backend.runs(),
      note: () => call<NoteMeta[]>({ kind: "list", entity: "note" }),
      ci_run: () => call<CiRun[]>({ kind: "list", entity: "ci_run" }),
    };
    return loaders[type]();
  };

  return {
    ...ctx,
    openNewTicket: (d) => ctx.openNewTicket({ ...d, instanceId: ctx.instanceId }),
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
    subscribe: (listener, type) =>
      type === "run" ? backend.subscribeRuns(listener) : backend.subscribe(listener),
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
    notes: notesApi(guard, call),
    mcp: mcpApi(manifest, guard, call, ctx.config),
  };
}
