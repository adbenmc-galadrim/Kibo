import { z } from "zod";
import { DESIGN_URL_MAX, type DesignFrame, PenpotInstanceUrl } from "./design";
import type { ExternalRef } from "./external-ref";
import { NodeId } from "./ids";
import {
  type Binding,
  BindingConfig,
  type CiLog,
  type CiRun,
  type GithubConnectOptions,
  type GithubProject,
  type GithubRepo,
  IntegrationId,
  type IntegrationStatus,
  McpServerId,
  McpServerInput,
  type McpServerView,
  RepoSlug,
  type SyncReport,
  type SyncState,
} from "./integrations";

const projectId = z.string().min(1);
const bindingId = z.string().min(1);

export const INTEGRATION_RPC = [
  z.object({ method: z.literal("listIntegrations") }),
  z.object({ method: z.literal("testIntegration"), id: IntegrationId }),
  z.object({ method: z.literal("disconnectIntegration"), id: z.enum(["github", "figma", "penpot", "mcp"]) }),
  z.object({ method: z.literal("getGithubConnectOptions") }),
  z.object({
    method: z.literal("connectGithub"),
    auth: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("gh") }),
      z.object({ mode: z.literal("token"), token: z.string().trim().min(1).max(255) }),
    ]),
  }),
  z.object({ method: z.literal("listGithubRepos"), query: z.string().max(100).default("") }),
  z.object({ method: z.literal("listGithubProjects"), repo: RepoSlug }),
  z.object({ method: z.literal("createBinding"), projectId, config: BindingConfig }),
  z.object({ method: z.literal("deleteBinding"), projectId, bindingId }),
  z.object({ method: z.literal("syncBinding"), projectId, bindingId }),
  z.object({ method: z.literal("getSyncState"), projectId }),
  z.object({
    method: z.literal("resolveOutbox"),
    projectId,
    outboxId: z.number().int().positive(),
    action: z.enum(["retry", "drop"]),
  }),
  z.object({ method: z.literal("listCiRuns"), projectId, ticketId: NodeId.nullable() }),
  z.object({ method: z.literal("getCiLog"), projectId, runId: z.number().int(), jobId: z.number().int() }),
  z.object({
    method: z.literal("connectFigma"),
    auth: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("token"), token: z.string().trim().min(1).max(255) }),
      z.object({ mode: z.literal("mcp"), url: z.string().url() }),
    ]),
  }),
  z.object({
    method: z.literal("connectPenpot"),
    url: PenpotInstanceUrl,
    token: z.string().trim().min(1).max(512),
  }),
  z.object({
    method: z.literal("linkDesignFrame"),
    projectId,
    ticketId: NodeId,
    url: z.string().min(1).max(DESIGN_URL_MAX),
  }),
  z.object({
    method: z.literal("getDesignFrame"),
    url: z.string().min(1).max(DESIGN_URL_MAX),
    refresh: z.boolean().default(false),
  }),
  z.object({ method: z.literal("listMcpServers") }),
  z.object({ method: z.literal("previewMcpServer"), server: McpServerInput }),
  z.object({
    method: z.literal("addMcpServer"),
    server: McpServerInput,
    confirmedCommandLine: z.string().max(8192),
    secrets: z.record(z.string(), z.string().min(1).max(4096)),
  }),
  z.object({ method: z.literal("removeMcpServer"), id: McpServerId }),
  z.object({ method: z.literal("setMcpServerEnabled"), id: McpServerId, enabled: z.boolean() }),
  z.object({ method: z.literal("testMcpServer"), id: McpServerId }),
] as const;

export type IntegrationRpcRequest = z.infer<(typeof INTEGRATION_RPC)[number]>;

export type IntegrationRpcResult = {
  listIntegrations: IntegrationStatus[];
  testIntegration: IntegrationStatus;
  disconnectIntegration: null;
  getGithubConnectOptions: GithubConnectOptions;
  connectGithub: { login: string };
  listGithubRepos: GithubRepo[];
  listGithubProjects: GithubProject[];
  createBinding: Binding;
  deleteBinding: null;
  syncBinding: SyncReport;
  getSyncState: SyncState;
  resolveOutbox: null;
  listCiRuns: CiRun[];
  getCiLog: CiLog;
  connectFigma: IntegrationStatus;
  connectPenpot: IntegrationStatus;
  linkDesignFrame: ExternalRef;
  getDesignFrame: DesignFrame;
  listMcpServers: McpServerView[];
  previewMcpServer: { commandLine: string };
  addMcpServer: McpServerView;
  removeMcpServer: null;
  setMcpServerEnabled: McpServerView;
  testMcpServer: McpServerView;
};
