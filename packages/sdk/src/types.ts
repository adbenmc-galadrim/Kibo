import type {
  AssetMime,
  AssetUrl,
  Capability,
  CiRun,
  CommandResult,
  ComponentCall,
  ComponentFormat,
  ComponentManifest,
  DeliverResult,
  DeliveryAgent,
  DeliveryResult,
  DesignFrame,
  EmbedView,
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
  ProjectAsset,
  ProjectCommand,
  ProjectSnapshot,
  ProjectSyncInfo,
  Question,
  QuestionRecipient,
  RunDenials,
  RunPeek,
  Selection,
  Spotlight,
  Sprint,
  SprintPatch,
  SprintView,
  Status,
  StatusId,
  StorybookOrigin,
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
  question: Question;
  sprint: SprintView;
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
  create(path: string, markdown: string): Promise<NoteMeta>;
  rename(from: string, to: string): Promise<NoteMeta>;
  remove(path: string): Promise<void>;
  search(query: string): Promise<NoteMeta[]>;
  info(): Promise<NotesInfo>;
  attach(notePath: string, name: string, mime: AssetMime, bytes: Uint8Array): Promise<{ path: string }>;
  asset(path: string): Promise<NoteAsset>;
};

export type NoteAsset = { mime: AssetMime; bytes: Uint8Array<ArrayBuffer> };

export type McpApi = {
  call(server: string, tool: string, args?: Record<string, unknown>): Promise<McpCallResult>;
  read(server: string, uri: string): Promise<McpCallResult>;
  importItem(server: string, item: McpImportItem): Promise<Ticket>;
};

export type QuestionsApi = {
  deliver(ticketId: string): Promise<DeliveryResult>;
  recipients(): Promise<QuestionRecipient[]>;
  imageUrl(questionId: string, imageId: string): string;
};
export type AllowAndResumeInput = { runId: string; questionId: string; rules: string[]; addDirs: string[] };
export type RunsApi = {
  peek(runId: string): Promise<RunPeek>;
  deliver(ticketId: string): Promise<DeliverResult>;
  denials(runId: string): Promise<RunDenials | null>;
  deliveryAgent(): Promise<DeliveryAgent | null>;
  allowAndResume(input: AllowAndResumeInput): Promise<void>;
};
export type DesignApi = {
  frame(url: string, opts?: { refresh?: boolean }): Promise<DesignFrame>;
  storybooks(): Promise<StorybookOrigin[]>;
};
export type EmbedApi = { open(url: string): Promise<EmbedView> };
export type AssetsApi = { list(): Promise<ProjectAsset[]>; url(name: string): Promise<AssetUrl> };
export type FocusApi = {
  active(): boolean;
  request(): void;
  exit(): void;
  subscribe(listener: () => void): () => void;
};
export type VisibilityApi = { visible(): boolean; subscribe(listener: () => void): () => void };
export type SelectionApi = {
  get(): Selection | null;
  set(selection: Selection | null): void;
  subscribe(listener: () => void): () => void;
};

export type SpotlightApi = {
  get(): Spotlight | null;
  subscribe(listener: () => void): () => void;
};
export type SprintInput = Pick<Sprint, "name" | "start" | "end">;
export type SprintsApi = {
  list(): Promise<SprintView[]>;
  create(input: SprintInput): Promise<Sprint>;
  update(sprintId: string, patch: SprintPatch): Promise<void>;
  remove(sprintId: string): Promise<void>;
  assign(ticketId: string, sprintId: string | null): Promise<void>;
};
export type OpenViewOptions = { question?: string };

export type KiboSdk = {
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  format: ComponentFormat;
  list<T extends EntityType>(type: T): Promise<EntityMap[T][]>;
  run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]>;
  subscribe(listener: () => void, type?: EntityType): () => void;
  openTicket(ticketId: string): void;
  openNewTicket(defaults: NewTicketDefaults): void;
  openFile(request: FileOpenRequest): void;
  openView(componentId: string, opts?: OpenViewOptions): void;
  data: InstanceData;
  fetch(url: string, init?: FetchInitInput): Promise<FetchResponse>;
  action<T = unknown>(name: string, input?: unknown): Promise<T>;
  setConfig(patch: Record<string, unknown>): Promise<void>;
  notes: NotesApi;
  mcp: McpApi;
  presence: PresenceApi;
  sharing(): Promise<ProjectSyncInfo>;
  capabilities: readonly Capability[];
  capability(name: Capability): void;
  assets: AssetsApi;
  design: DesignApi;
  embed: EmbedApi;
  questions: QuestionsApi;
  runs: RunsApi;
  sprints: SprintsApi;
  openRun(runId: string): void;
  focus: FocusApi;
  visibility: VisibilityApi;
  selection: SelectionApi;
  spotlight: SpotlightApi;
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
  | "instanceId"
  | "config"
  | "viewer"
  | "surface"
  | "format"
  | "openTicket"
  | "openNewTicket"
  | "openFile"
  | "openView"
> &
  Partial<Pick<KiboSdk, "focus" | "visibility" | "selection" | "spotlight" | "openRun">>;
export type SdkMode = "builtin" | "gated";

export type ComponentModule = { manifest: ComponentManifest; Component: ComponentType };
