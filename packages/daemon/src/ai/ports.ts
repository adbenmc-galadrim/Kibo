import type {
  AiEvent,
  AiStatus,
  ComponentFormat,
  ComponentManifest,
  ComponentOrigin,
  DraftKind,
  FileDiff,
  GrantedPermissions,
  Instance,
  PublishResult,
  PublishUsage,
  RegistryVersion,
  RunState,
  ValidationReport,
} from "@kibo/schema";

export type { RunState };
export type ExecResult = { code: number; stdout: string; stderr: string };
export type Exec = (argv: string[], timeoutMs: number) => Promise<ExecResult | null>;

export type ToolCall = { toolName: string; toolInput: unknown };
export type GuardDecision = { decision: "allow" } | { decision: "deny"; reason: string };
export type Guard = (call: ToolCall) => GuardDecision;

export type AgentRunRequest = {
  profileId: "assistant" | "generateur";
  label: string;
  cwd: string;
  prompt: string;
  args: string[];
  env: Record<string, string>;
  resumeSessionId: string | null;
  guard: Guard;
};
export type RunEnd = {
  state: "done" | "failed" | "cancelled";
  sessionId: string | null;
  stdout: string;
  error: string | null;
};
export type AgentRuns = {
  enqueue(req: AgentRunRequest): string;
  cancel(runId: string): void;
  state(runId: string): RunState | null;
  onState(runId: string, listener: (state: RunState) => void): () => void;
  onEnd(runId: string, listener: (end: RunEnd) => void): () => void;
};

export type ClaudeCapabilities = {
  tools: boolean;
  jsonSchema: boolean;
  strictMcp: boolean;
  noSessionPersistence: boolean;
};
export type AiAvailability = {
  status(): AiStatus;
  capabilities(): ClaudeCapabilities | null;
  refresh(): Promise<AiStatus>;
  settled(): Promise<AiStatus>;
};

export type ScaffoldOptions = {
  dir: string;
  id: string;
  title: string;
  kind: DraftKind;
  withServer: boolean;
  formats: ComponentFormat[];
};
export type Devkit = {
  scaffold(opts: ScaffoldOptions): Promise<void>;
  infer(dir: string): Promise<GrantedPermissions>;
  validate(dir: string): Promise<ValidationReport>;
  hash(dir: string): Promise<string>;
};

export type CatalogEntry = { id: string; title: string; description: string; kind: DraftKind };
export type PublishedComponent = {
  version: string;
  manifest: ComponentManifest;
  granted: GrantedPermissions;
  origin: ComponentOrigin;
  hash: string;
};
export type ComponentCatalog = {
  entries(): CatalogEntry[];
  isTaken(id: string): boolean;
  sourceDir(id: string): string;
  latest(id: string): PublishedComponent | null;
  usages(id: string): PublishUsage[];
  publish(input: {
    id: string;
    strategy: "update-all" | "new-version";
    origin: "ai";
  }): Promise<PublishResult>;
  approve(input: {
    id: string;
    version: string;
    hash: string;
    trust: "trusted" | "sandboxed";
  }): Promise<RegistryVersion>;
};

export type ProjectAccess = {
  pageExists(projectId: string, pageId: string): boolean;
  addInstance(projectId: string, pageId: string, ref: string): Promise<Instance>;
};
export type Differ = (input: {
  path: string;
  before: string | null;
  after: string | null;
}) => Promise<FileDiff>;
export type Editor = { openFolder(dir: string): Promise<void> };
export type AiEvents = { publish(event: AiEvent): void };
export type Clock = { now(): number; setTimeout(fn: () => void, ms: number): () => void };
