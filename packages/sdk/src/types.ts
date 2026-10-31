import type {
  AssetUrl,
  Capability,
  CiRun,
  CommandResult,
  ComponentCall,
  ComponentFormat,
  ComponentManifest,
  ComponentSettings,
  DesignFrame,
  EntityType,
  FetchInitInput,
  FetchResponse,
  Link,
  Page,
  ProjectAsset,
  ProjectCommand,
  ProjectEditRequest,
  ProjectEvent,
  ProjectInfo,
  ProjectSnapshot,
  Question,
  QuestionRecipient,
  Selection,
  Spotlight,
  Sprint,
  SprintPatch,
  SprintView,
  Status,
  StatusId,
  StorybookOrigin,
  Surface,
  T3Launch,
  T3Preview,
  T3Status,
  T3Thread,
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
  ci_run: CiRun;
  question: Question;
  sprint: SprintView;
  project_event: ProjectEvent;
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

export type QuestionsApi = {
  recipients(): Promise<QuestionRecipient[]>;
  imageUrl(questionId: string, imageId: string): string;
};
export type DesignApi = {
  frame(url: string, opts?: { refresh?: boolean }): Promise<DesignFrame>;
  storybooks(): Promise<StorybookOrigin[]>;
};
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
export type SprintInput = Pick<Sprint, "code" | "name" | "start" | "end">;
export type SprintsApi = {
  list(): Promise<SprintView[]>;
  create(input: SprintInput): Promise<Sprint>;
  update(sprintId: string, patch: SprintPatch): Promise<void>;
  remove(sprintId: string): Promise<void>;
  assign(ticketId: string, sprintId: string | null): Promise<void>;
  open(sprintId: string): void;
};
export type { ProjectInfo };
export type ProjectApi = {
  get(): Promise<ProjectInfo>;
  subscribe(listener: () => void): () => void;
  edit(request: ProjectEditRequest): void;
};
export type SettingsApi = {
  get(): Promise<ComponentSettings>;
  subscribe(listener: () => void): () => void;
};
export type OpenViewOptions = { question?: string; intent?: Spotlight };

export type T3Api = {
  status(): Promise<T3Status>;
  preview(ticketKey: string): Promise<T3Preview>;
  launch(ticketKey: string): Promise<T3Launch>;
  threadOf(ticketKey: string): Promise<T3Thread | null>;
};

export type KiboSdk = {
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  format: ComponentFormat;
  list<T extends EntityType>(type: T): Promise<EntityMap[T][]>;
  run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]>;
  subscribe(listener: () => void): () => void;
  openTicket(ticketId: string): void;
  openNewTicket(defaults: NewTicketDefaults): void;
  openFile(request: FileOpenRequest): void;
  openView(componentId: string, opts?: OpenViewOptions): void;
  toast(message: string): void;
  data: InstanceData;
  fetch(url: string, init?: FetchInitInput): Promise<FetchResponse>;
  action<T = unknown>(name: string, input?: unknown): Promise<T>;
  setConfig(patch: Record<string, unknown>): Promise<void>;
  capabilities: readonly Capability[];
  capability(name: Capability): void;
  assets: AssetsApi;
  design: DesignApi;
  questions: QuestionsApi;
  sprints: SprintsApi;
  t3: T3Api;
  settings: SettingsApi;
  project: ProjectApi;
  focus: FocusApi;
  visibility: VisibilityApi;
  selection: SelectionApi;
  spotlight: SpotlightApi;
};

export type ProjectBackend = {
  snapshot(): Promise<ProjectSnapshot>;
  run(cmd: ProjectCommand): Promise<unknown>;
  call(call: ComponentCall): Promise<unknown>;
  subscribe(listener: () => void): () => void;
  subscribeConfig?(listener: () => void): () => void;
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
  Partial<Pick<KiboSdk, "focus" | "visibility" | "selection" | "spotlight">> & {
    openSprint?(sprintId: string): void;
    editProject?(request: ProjectEditRequest): void;
  };
export type SdkMode = "builtin" | "gated";

export type ComponentModule = { manifest: ComponentManifest; Component: ComponentType };
