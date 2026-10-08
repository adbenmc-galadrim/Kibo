import { z } from "zod";
import { ConfigCommand, type Domain, HostSettings, type WorkspaceConfig } from "./agent";
import type { AiEvent } from "./ai";
import { AI_RPC, type AiRpcResult } from "./ai-rpc";
import {
  type FilesInfo,
  MAX_PROJECT_ASSET_BYTES,
  MAX_UPLOAD_CHUNK_BASE64,
  type ProjectAsset,
  ProjectAssetMime,
  ProjectAssetName,
} from "./asset";
import { ComponentCall } from "./call";
import type { CodeEvent } from "./code";
import { ProjectCommand } from "./command";
import {
  ApprovableTrust,
  type ComponentSummary,
  type DraftSummary,
  type PublishPreview,
  type PublishResult,
  type RegistryVersion,
  type RuntimeInfo,
} from "./component";
import type { KiboErrorCode } from "./errors";
import { IconInput, IconOwner } from "./icon";
import { Base64, NodeId, ProjectKey, Sha256 } from "./ids";
import type { Instance } from "./instance";
import type { Binding, IntegrationEvent } from "./integrations";
import { INTEGRATION_RPC, type IntegrationRpcResult } from "./integrations-rpc";
import type { Link } from "./link";
import { ComponentId } from "./manifest";
import { MARKET_RPC_REQUESTS, type MarketRpcResult } from "./market-rpc";
import type { NotesInfo } from "./note";
import type { Page } from "./page";
import { PHASE14_RPC, type Phase14RpcResult } from "./phase14-rpc";
import { type ProjectMeta, ProjectPatch } from "./project";
import type { Question } from "./question";
import type { Rule } from "./rule";
import type { AgentsState, AssignPreview, HostView, RunChanged, RunLogEntry, RunView } from "./run";
import { SemVer } from "./semver";
import type { ProjectSyncInfo } from "./sharing";
import type { Status, StatusId } from "./status";
import type { Phase7Event } from "./sync";
import { SYNC_RPC_REQUESTS, type SyncRpcResult } from "./sync-rpc";
import { TabsState } from "./tabs";
import type { Ticket } from "./ticket";

export type TicketView = Ticket & {
  progress: { done: number; total: number };
  waitingOn: string[];
  keyLabel: string;
  openQuestions: number;
};
export type ProjectSnapshot = {
  meta: ProjectMeta;
  workflow: Status[];
  pages: Page[];
  tickets: TicketView[];
  links: Link[];
  questions: Question[];
  instances: Instance[];
  rules: Rule[];
  bindings: Binding[];
  nextTicketKey: string | null;
  sync: ProjectSyncInfo;
  domains?: Domain[];
  viewer?: string;
  icon?: string | null;
};
export type ProjectSummary = ProjectMeta & {
  counts: Record<StatusId, number>;
  icon?: string | null;
  demo?: boolean;
};
export type Session = { user: string; notifications: "native" | "browser" };
export type Topic = "agents" | "config";
export type ChangeMessage =
  | { projectId: string | null }
  | { topic: Topic }
  | RunChanged
  | CodeEvent
  | IntegrationEvent
  | AiEvent
  | Phase7Event;

export const RpcRequest = z.discriminatedUnion("method", [
  z.object({ method: z.literal("getSession") }),
  z.object({ method: z.literal("listProjects") }),
  z.object({
    method: z.literal("createProject"),
    name: z.string().trim().min(1),
    key: ProjectKey,
    folder: z.string().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  z.object({ method: z.literal("getProject"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("updateProject"), projectId: z.string().min(1), patch: ProjectPatch }),
  z.object({ method: z.literal("deleteProject"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("setIcon"), owner: IconOwner, icon: IconInput.nullable() }),
  z.object({
    method: z.literal("command"),
    projectId: z.string().min(1),
    instanceId: z.string().min(1).optional(),
    command: ProjectCommand,
  }),
  z.object({
    method: z.literal("fileTicket"),
    ticketId: NodeId,
    projectId: z.string().min(1),
    parentId: NodeId.nullable().optional(),
  }),
  z.object({ method: z.literal("getConfig") }),
  z.object({ method: z.literal("config"), command: ConfigCommand }),
  z.object({ method: z.literal("getAgents") }),
  z.object({ method: z.literal("getRunLog"), runId: z.string().min(1) }),
  z.object({
    method: z.literal("previewAssign"),
    projectId: z.string().min(1),
    ticketId: NodeId,
    profileId: z.string().min(1),
  }),
  z.object({
    method: z.literal("assignAgent"),
    projectId: z.string().min(1),
    ticketId: NodeId,
    profileId: z.string().min(1),
    brief: z.string().max(10_000),
    fresh: z.boolean().default(false),
  }),
  z.object({
    method: z.literal("answerRun"),
    runId: z.string().min(1),
    text: z.string().trim().min(1).max(10_000),
  }),
  z.object({ method: z.literal("cancelRun"), runId: z.string().min(1) }),
  z.object({ method: z.literal("moveRun"), runId: z.string().min(1), index: z.number().int().nonnegative() }),
  z.object({ method: z.literal("setRunPriority"), runId: z.string().min(1), priority: z.boolean() }),
  z.object({ method: z.literal("setHost"), patch: HostSettings.partial() }),
  z.object({ method: z.literal("getTabs") }),
  z.object({ method: z.literal("saveTabs"), state: TabsState }),
  z.object({ method: z.literal("listComponents") }),
  z.object({
    method: z.literal("componentCall"),
    projectId: z.string().min(1),
    instanceId: z.string().min(1),
    call: ComponentCall,
  }),
  z.object({
    method: z.literal("approveComponent"),
    id: ComponentId,
    version: SemVer,
    hash: Sha256,
    trust: ApprovableTrust,
  }),
  z.object({ method: z.literal("revokeComponent"), id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("rehashComponent"), id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("previewPublish"), id: ComponentId }),
  z.object({
    method: z.literal("publishComponent"),
    id: ComponentId,
    strategy: z.enum(["update-all", "new-version"]),
  }),
  z.object({
    method: z.literal("updateInstance"),
    projectId: z.string().min(1),
    instanceId: z.string().min(1),
    to: SemVer,
  }),
  z.object({ method: z.literal("uninstallComponent"), id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("listDrafts") }),
  z.object({ method: z.literal("getNotesDir"), projectId: z.string().min(1) }),
  z.object({
    method: z.literal("setNotesDir"),
    projectId: z.string().min(1),
    dir: z.string().min(1).max(4096),
  }),
  z.object({ method: z.literal("getRuntimeInfo") }),
  z.object({ method: z.literal("installCli") }),
  z.object({ method: z.literal("cliStatus") }),
  z.object({
    method: z.literal("reportComponentRefusal"),
    projectId: z.string().min(1),
    instanceId: z.string().min(1),
    kind: z.enum(["navigate", "focus"]),
  }),
  z.object({ method: z.literal("listAssets"), projectId: z.string().min(1) }),
  z.object({
    method: z.literal("beginAssetUpload"),
    projectId: z.string().min(1),
    name: ProjectAssetName,
    mime: ProjectAssetMime,
    size: z.number().int().positive().max(MAX_PROJECT_ASSET_BYTES),
  }),
  z.object({
    method: z.literal("appendAssetUpload"),
    uploadId: z.string().uuid(),
    index: z.number().int().nonnegative(),
    bytes: z.string().min(1).max(MAX_UPLOAD_CHUNK_BASE64).pipe(Base64),
  }),
  z.object({ method: z.literal("finishAssetUpload"), uploadId: z.string().uuid() }),
  z.object({ method: z.literal("cancelAssetUpload"), uploadId: z.string().uuid() }),
  z.object({ method: z.literal("removeAsset"), projectId: z.string().min(1), name: ProjectAssetName }),
  z.object({ method: z.literal("getFilesDir"), projectId: z.string().min(1) }),
  z.object({
    method: z.literal("setFilesDir"),
    projectId: z.string().min(1),
    dir: z.string().min(1).max(1024).nullable(),
  }),
  ...INTEGRATION_RPC,
  ...AI_RPC,
  ...MARKET_RPC_REQUESTS,
  ...SYNC_RPC_REQUESTS,
  ...PHASE14_RPC,
]);
export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcResult = {
  getSession: Session;
  listProjects: ProjectSummary[];
  createProject: ProjectMeta;
  getProject: ProjectSnapshot;
  updateProject: ProjectMeta;
  deleteProject: null;
  setIcon: { icon: string | null };
  command: unknown;
  fileTicket: { ticketId: string; key: string | null };
  getConfig: WorkspaceConfig;
  config: unknown;
  getAgents: AgentsState;
  getRunLog: RunLogEntry[];
  previewAssign: AssignPreview;
  assignAgent: RunView;
  answerRun: RunView;
  cancelRun: RunView;
  moveRun: null;
  setRunPriority: null;
  setHost: HostView;
  getTabs: TabsState;
  saveTabs: null;
  listComponents: ComponentSummary[];
  componentCall: unknown;
  approveComponent: RegistryVersion;
  revokeComponent: null;
  rehashComponent: RegistryVersion;
  previewPublish: PublishPreview;
  publishComponent: PublishResult;
  updateInstance: Instance;
  uninstallComponent: null;
  listDrafts: DraftSummary[];
  getNotesDir: NotesInfo;
  setNotesDir: NotesInfo;
  getRuntimeInfo: RuntimeInfo;
  installCli: { path: string };
  cliStatus: { path: string; installed: boolean };
  reportComponentRefusal: null;
  listAssets: ProjectAsset[];
  beginAssetUpload: { uploadId: string };
  appendAssetUpload: { received: number };
  finishAssetUpload: ProjectAsset;
  cancelAssetUpload: null;
  removeAsset: null;
  getFilesDir: FilesInfo;
  setFilesDir: FilesInfo;
} & IntegrationRpcResult &
  AiRpcResult &
  MarketRpcResult &
  SyncRpcResult &
  Phase14RpcResult;

export type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KiboErrorCode; message: string } };
