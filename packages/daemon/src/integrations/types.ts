import type { Database } from "bun:sqlite";
import type {
  Binding,
  CiRun,
  CommandResult,
  IntegrationEvent,
  IntegrationId,
  IntegrationRpcRequest,
  IntegrationRpcResult,
  IntegrationStatus,
  MappedRemote,
  McpCallResult,
  McpImportItem,
  ProjectCommand,
  ProjectMeta,
  ProjectSnapshot,
  PullPage,
  PushOp,
  SecretName,
  Ticket,
} from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { DesignGate } from "../design/gate";
import type { CommandEvent, CommandInterceptor, CommandMeta } from "../docs";

export type { DesignGate } from "../design/gate";
export type { CommandEvent, CommandInterceptor, CommandMeta, CommandOrigin } from "../docs";
export type SystemNotification = Notice;
export type GhRunner = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;

export type IntegrationHost = {
  user: string;
  identity(projectId: string): string;
  home: string;
  db: Database;
  transaction<T>(fn: () => T): T;
  projects(): ProjectMeta[];
  snapshot(projectId: string): ProjectSnapshot;
  command<C extends ProjectCommand>(projectId: string, cmd: C, meta: CommandMeta): CommandResult[C["method"]];
  onCommand(listener: (e: CommandEvent) => void): () => void;
  intercept(interceptor: CommandInterceptor): () => void;
  broadcast(event: IntegrationEvent): void;
  notify(n: SystemNotification): void;
  gitRemoteUrl(projectId: string): Promise<string | null>;
  gitAvailable(): Promise<boolean>;
  gh: GhRunner;
  now(): number;
  sandboxOrigin(): string | null;
};

export type SecretStore = {
  availability(): Promise<{ ok: true } | { ok: false; reason: string }>;
  has(name: SecretName): Promise<boolean>;
  get(name: SecretName): Promise<string | null>;
  set(name: SecretName, value: string): Promise<void>;
  delete(name: SecretName): Promise<void>;
};
export type SecretResolver = (name: SecretName) => Promise<string | null>;

export type GithubCredentials = {
  token(): Promise<string | null>;
  login(): string | null;
  mode(): "gh" | "token" | null;
};

export type AuthHeader = { header: string; prefix: string };
export type InternalRule = { host: string; suffix: boolean; auth: boolean; insecureLoopback?: boolean };
export type IntegrationFetchInit = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  bearer?: string | null;
  auth?: AuthHeader;
  maxBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};
export type IntegrationResponse = {
  status: number;
  headers: Headers;
  body: Uint8Array;
  truncated: boolean;
  url: string;
};
export type IntegrationFetch = (
  url: string,
  init: IntegrationFetchInit,
  rules: InternalRule[],
) => Promise<IntegrationResponse>;

export type AdapterRunner = {
  pull(projectId: string, binding: Binding, cursor: string | null): Promise<PullPage>;
  push(projectId: string, binding: Binding, op: PushOp): Promise<MappedRemote>;
};

export type IntegrationMethod = IntegrationRpcRequest["method"];
export type IntegrationHandlers = {
  [M in IntegrationMethod]?: (
    req: Extract<IntegrationRpcRequest, { method: M }>,
  ) => Promise<IntegrationRpcResult[M]>;
};
export type IntegrationProbe = {
  id: IntegrationId;
  status(): Promise<IntegrationStatus>;
  test?(): Promise<IntegrationStatus>;
  disconnect?(): Promise<void>;
};

export type McpCallContext = { projectId: string; instanceId: string };
export type McpComponentGate = {
  call(
    ctx: McpCallContext,
    server: string,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<McpCallResult>;
  read(ctx: McpCallContext, server: string, uri: string): Promise<McpCallResult>;
  importItem(ctx: McpCallContext, server: string, item: McpImportItem): Promise<Ticket>;
};
export type ComponentIntegrationHooks = {
  aliases: Map<string, URL>;
  observe(host: string, headers: Headers): void;
  secret: SecretResolver;
  mcp: McpComponentGate | null;
  design: DesignGate | null;
  ciRuns: ((projectId: string) => Promise<CiRun[]>) | null;
};
