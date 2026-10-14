import { z } from "zod";
import { AgentRef } from "./agent";
import {
  type FilesInfo,
  MAX_PROJECT_ASSET_BYTES,
  MAX_UPLOAD_CHUNK_BASE64,
  type ProjectAsset,
  ProjectAssetMime,
  ProjectAssetName,
} from "./asset";
import { ComponentCall } from "./call";
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
import { IconInput, IconOwner } from "./icon";
import { Base64, NodeId, ProjectKey, Sha256 } from "./ids";
import type { Instance } from "./instance";
import { ComponentId } from "./manifest";
import type { NoteMeta, NotesInfo } from "./note";
import { type ProjectMeta, ProjectPatch } from "./project";
import type { DeliveryResult } from "./question";
import type { ProjectSnapshot, ProjectSummary, Session } from "./rpc";
import type { AgentsState, AssignPreview, HostView, RunLogEntry, RunView } from "./run";
import { SemVer } from "./semver";
import { TabsState } from "./tabs";
import { ConfigCommand, HostSettings, type WorkspaceConfig } from "./workspace-config";

export const CORE_RPC = [
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
    profileId: AgentRef,
  }),
  z.object({
    method: z.literal("assignAgent"),
    projectId: z.string().min(1),
    ticketId: NodeId,
    profileId: AgentRef,
    brief: z.string().max(10_000),
    fresh: z.boolean().default(false),
  }),
  z.object({
    method: z.literal("answerRun"),
    runId: z.string().min(1),
    text: z.string().trim().min(1).max(10_000),
  }),
  z.object({ method: z.literal("deliverAnswers"), projectId: z.string().min(1), ticketId: NodeId }),
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
  z.object({ method: z.literal("listNotes"), projectId: z.string().min(1) }),
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
] as const;

export type CoreRpcResult = {
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
  deliverAnswers: DeliveryResult;
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
  listNotes: NoteMeta[];
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
};
