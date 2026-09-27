import type {
  CiRun,
  CommandResult,
  ComponentCall,
  ComponentManifest,
  EntityType,
  FetchInitInput,
  FetchResponse,
  Link,
  McpCallResult,
  McpImportItem,
  NoteContent,
  NoteMeta,
  NotesInfo,
  Page,
  PresencePeer,
  ProjectCommand,
  ProjectSnapshot,
  ProjectSyncInfo,
  Status,
  StatusId,
  Surface,
  Ticket,
  TicketRun,
  TicketView,
} from "@kibo/schema";
import type { ComponentType } from "react";

export type EntityMap = {
  ticket: TicketView;
  status: Status;
  link: Link;
  page: Page;
  run: TicketRun;
  note: NoteMeta;
  ci_run: CiRun;
};
export type NewTicketDefaults = { statusId?: StatusId; parentId?: string | null; instanceId?: string };
export type FileOpenRequest = { path: string; line?: number | null; origin?: string | null };
export type FileTarget = FileOpenRequest;

export type InstanceData = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

export type NotesApi = {
  read(path: string): Promise<NoteContent>;
  write(path: string, markdown: string, expectedMtime: number | null): Promise<NoteMeta>;
  rename(from: string, to: string): Promise<NoteMeta>;
  remove(path: string): Promise<void>;
  search(query: string): Promise<NoteMeta[]>;
  info(): Promise<NotesInfo>;
};

export type McpApi = {
  call(server: string, tool: string, args?: Record<string, unknown>): Promise<McpCallResult>;
  read(server: string, uri: string): Promise<McpCallResult>;
  importItem(server: string, item: McpImportItem): Promise<Ticket>;
};

export type KiboSdk = {
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  list<T extends EntityType>(type: T): Promise<EntityMap[T][]>;
  run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]>;
  subscribe(listener: () => void, type?: EntityType): () => void;
  openTicket(ticketId: string): void;
  openNewTicket(defaults: NewTicketDefaults): void;
  openFile(request: FileOpenRequest): void;
  openView(componentId: string): void;
  data: InstanceData;
  fetch(url: string, init?: FetchInitInput): Promise<FetchResponse>;
  action<T = unknown>(name: string, input?: unknown): Promise<T>;
  notes: NotesApi;
  mcp: McpApi;
  presence: PresenceApi;
  sharing(): Promise<ProjectSyncInfo>;
};

export type PresenceApi = {
  list(): Promise<PresencePeer[]>;
  subscribe(listener: () => void): () => void;
};

export type ProjectBackend = {
  snapshot(): Promise<ProjectSnapshot>;
  run(cmd: ProjectCommand): Promise<unknown>;
  call(call: ComponentCall): Promise<unknown>;
  subscribe(listener: () => void): () => void;
  runs(): Promise<TicketRun[]>;
  subscribeRuns(listener: () => void): () => void;
  subscribePresence?(listener: () => void): () => void;
};

export type SdkContext = Pick<
  KiboSdk,
  "instanceId" | "config" | "viewer" | "surface" | "openTicket" | "openNewTicket" | "openFile" | "openView"
>;
export type SdkMode = "builtin" | "gated";

export type ComponentModule = { manifest: ComponentManifest; Component: ComponentType };
