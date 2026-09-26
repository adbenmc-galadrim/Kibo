import { z } from "zod";
import { ConfigCommand, HostSettings, type WorkspaceConfig } from "./agent";
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
  Sha256,
} from "./component";
import type { KiboErrorCode } from "./errors";
import { NodeId, ProjectKey } from "./ids";
import type { Instance } from "./instance";
import type { Binding, IntegrationEvent } from "./integrations";
import { INTEGRATION_RPC, type IntegrationRpcResult } from "./integrations-rpc";
import type { Link } from "./link";
import type { NotesInfo } from "./note";
import type { Page } from "./page";
import type { ProjectMeta } from "./project";
import type { Rule } from "./rule";
import type { AgentsState, AssignPreview, HostView, RunChanged, RunLogEntry, RunView } from "./run";
import { SemVer } from "./semver";
import type { Status, StatusId } from "./status";
import { TabsState } from "./tabs";
import type { Ticket } from "./ticket";

const ComponentId = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/);

export type TicketView = Ticket & { progress: { done: number; total: number }; waitingOn: string[] };
export type ProjectSnapshot = {
  meta: ProjectMeta;
  workflow: Status[];
  pages: Page[];
  tickets: TicketView[];
  links: Link[];
  instances: Instance[];
  rules: Rule[];
  bindings: Binding[];
  nextTicketKey: string;
};
export type ProjectSummary = ProjectMeta & { counts: Record<StatusId, number> };
export type Session = { user: string; notifications: "native" | "browser" };
export type Topic = "agents" | "config";
export type ChangeMessage =
  | { projectId: string | null }
  | { topic: Topic }
  | RunChanged
  | CodeEvent
  | IntegrationEvent;

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
  z.object({ method: z.literal("command"), projectId: z.string().min(1), command: ProjectCommand }),
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
    kind: z.literal("navigate"),
  }),
  ...INTEGRATION_RPC,
]);
export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcResult = {
  getSession: Session;
  listProjects: ProjectSummary[];
  createProject: ProjectMeta;
  getProject: ProjectSnapshot;
  command: unknown;
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
} & IntegrationRpcResult;

export type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KiboErrorCode; message: string } };
