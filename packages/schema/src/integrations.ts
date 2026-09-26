import { z } from "zod";
import { KiboError, type KiboErrorCode } from "./errors";
import { NodeId } from "./ids";
import { StatusId } from "./status";

export const RepoSlug = z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
export type RepoSlug = z.infer<typeof RepoSlug>;

export const WebUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "http(s) url only");

export const McpServerId = z.string().regex(/^[a-z0-9-]{1,32}$/);
export const RESERVED_MCP_IDS: readonly string[] = ["figma"];
export const EnvName = z.string().regex(/^[A-Z_][A-Z0-9_]{0,63}$/);

const SECRET_NAME = /^(github|figma|mcp)(:[a-z0-9-]{1,32}(:[A-Z_][A-Z0-9_]{0,63})?)?$/;
export type SecretName = `${"github" | "mcp" | "figma"}${"" | `:${string}`}`;
export const SecretNameSchema = z.custom<SecretName>(
  (v) => typeof v === "string" && SECRET_NAME.test(v),
  "invalid secret name",
);
export const GITHUB_SECRET_HOSTS: readonly string[] = ["api.github.com", "uploads.github.com"];

export const GithubIssueRef = z.object({
  kind: z.literal("github_issue"),
  bindingId: z.string().min(1),
  repo: RepoSlug,
  number: z.number().int().positive().nullable(),
  nodeId: z.string().min(1).nullable(),
  url: WebUrl.nullable(),
});
export type GithubIssueRef = z.infer<typeof GithubIssueRef>;

export const FigmaNodeRef = z.object({
  kind: z.literal("figma_node"),
  fileKey: z.string().regex(/^[A-Za-z0-9]{6,64}$/),
  nodeId: z.string().regex(/^\d+:\d+$/),
  url: WebUrl,
  name: z.string().max(200),
});
export type FigmaNodeRef = z.infer<typeof FigmaNodeRef>;

export const McpItemRef = z.object({
  kind: z.literal("mcp_item"),
  server: McpServerId,
  itemId: z.string().min(1).max(256),
  url: WebUrl.nullable(),
  title: z.string().min(1).max(500),
});
export type McpItemRef = z.infer<typeof McpItemRef>;

export function githubIssueState(ref: GithubIssueRef): "pending" | "linked" | "broken" {
  if (ref.number === null) return "pending";
  return ref.url === null ? "broken" : "linked";
}

export const BINDING_PREFIX = "binding:";

export function bindingIdOf(instanceId: string): string {
  if (!instanceId.startsWith(BINDING_PREFIX)) {
    throw new KiboError("INVALID_INPUT", "adapter actions run for a binding only");
  }
  return instanceId.slice(BINDING_PREFIX.length);
}

export const StatusMap = z.record(StatusId, z.string().min(1));
export type StatusMap = z.infer<typeof StatusMap>;

export const BindingConfig = z.object({
  repo: RepoSlug,
  project: z
    .object({
      owner: z.string().min(1),
      number: z.number().int().positive(),
      nodeId: z.string().min(1),
      statusFieldId: z.string().min(1),
      statusMap: StatusMap,
    })
    .nullable(),
  importClosed: z.boolean().default(false),
  labels: z.array(z.string().trim().min(1)).max(20).default([]),
});
export type BindingConfig = z.infer<typeof BindingConfig>;

export const Binding = z.object({
  id: z.string().min(1),
  adapter: z.enum(["github-issues"]),
  config: BindingConfig,
  createdBy: z.string().min(1),
  runner: z.string().min(1),
});
export type Binding = z.infer<typeof Binding>;

export const InstanceSource = z.object({ bindingId: z.string().min(1) });
export type InstanceSource = z.infer<typeof InstanceSource>;

export const SyncedFields = z.object({
  title: z.string().min(1),
  description: z.string(),
  statusId: StatusId,
  closed: z.boolean(),
});
export type SyncedFields = z.infer<typeof SyncedFields>;
export type SyncedField = keyof SyncedFields;

const IsoDate = z.string().datetime({ offset: true });

export const PushOp = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), ticketId: NodeId, fields: SyncedFields, since: IsoDate.nullable() }),
  z.object({ kind: z.literal("update"), remoteId: z.string().min(1), patch: SyncedFields.partial() }),
]);
export type PushOp = z.infer<typeof PushOp>;

export const MappedRemote = z.object({
  remoteId: z.string().min(1),
  updatedAt: IsoDate,
  fields: SyncedFields,
  ref: GithubIssueRef,
  labels: z.array(z.string()),
});
export type MappedRemote = z.infer<typeof MappedRemote>;

export const PullInput = z.object({ cursor: z.string().max(4096).nullable() });
export const PullPage = z.object({
  items: z.array(MappedRemote),
  cursor: z.string().max(4096).nullable(),
  more: z.boolean(),
});
export type PullPage = z.infer<typeof PullPage>;

export const IntegrationId = z.enum([
  "git",
  "github",
  "github-issues",
  "github-actions",
  "figma",
  "notifications",
  "markdown",
  "mcp",
]);
export type IntegrationId = z.infer<typeof IntegrationId>;
export type IntegrationState = "active" | "connected" | "disconnected" | "error";
export type IntegrationStatus = {
  id: IntegrationId;
  state: IntegrationState;
  account: string | null;
  servers: string[];
  error: { code: KiboErrorCode; message: string } | null;
  resumeAt: number | null;
};

export const CiJobSummary = z.object({
  jobId: z.number().int(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type CiJobSummary = z.infer<typeof CiJobSummary>;
export type CiRun = {
  repo: RepoSlug;
  runId: number;
  prNumber: number | null;
  ticketKey: string | null;
  headSha: string;
  workflow: string;
  status: string;
  conclusion: string | null;
  url: string;
  startedAt: string | null;
  updatedAt: string;
  jobs: CiJobSummary[];
};
export type CiLog = { text: string; truncated: boolean; errorLines: number[] };

const loopbackHosts = ["127.0.0.1", "localhost", "[::1]"];
export const mcpUrlAllowed = (raw: string): boolean => {
  if (!URL.canParse(raw)) return false;
  const u = new URL(raw);
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && loopbackHosts.includes(u.hostname);
};

const UNSAFE_TEXT = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const SafeText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((v) => !UNSAFE_TEXT.test(v), "control or bidi character");
const MINIMAL_ENV: readonly string[] = ["PATH", "HOME", "LANG"];
const McpEnvName = EnvName.refine((n) => !MINIMAL_ENV.includes(n), "reserved environment variable");

export const McpServerInput = z
  .discriminatedUnion("transport", [
    z.object({
      transport: z.literal("stdio"),
      id: McpServerId,
      name: z.string().trim().min(1).max(60),
      command: SafeText(1024).pipe(z.string().trim().min(1)),
      args: z.array(SafeText(4096)).max(64).default([]),
      envNames: z.array(McpEnvName).max(32).default([]),
    }),
    z.object({
      transport: z.literal("http"),
      id: McpServerId,
      name: z.string().trim().min(1).max(60),
      url: z.string().url().refine(mcpUrlAllowed, "https required unless loopback"),
      bearer: z.boolean().default(false),
    }),
  ])
  .refine((s) => !RESERVED_MCP_IDS.includes(s.id), "reserved server id");
export type McpServerInput = z.infer<typeof McpServerInput>;
export type McpToolInfo = { name: string; description: string | null; inputSchema: Record<string, unknown> };
export type McpServerView = McpServerInput & {
  enabled: boolean;
  state: "idle" | "connected" | "error";
  error: string | null;
  tools: McpToolInfo[];
  secretsSet: string[];
};
export type McpContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
export type McpCallResult = { content: McpContent[]; isError: boolean; truncated: boolean };
export const McpImportItem = z.object({
  itemId: z.string().min(1).max(256),
  title: z.string().trim().min(1).max(500),
  url: WebUrl.nullable(),
});
export type McpImportItem = z.infer<typeof McpImportItem>;

export type FigmaPreview = {
  png: string | null;
  fetchedAt: number | null;
  reachable: boolean;
  available: boolean;
};
export type GithubRepo = { fullName: RepoSlug; private: boolean; description: string | null };
export type GithubProject = {
  owner: string;
  number: number;
  nodeId: string;
  title: string;
  statusField: { id: string; options: { id: string; name: string }[] } | null;
};
export type GithubConnectOptions = {
  ghAvailable: boolean;
  ghLogin: string | null;
  mode: "gh" | "token" | null;
};

export type BindingState = {
  bindingId: string;
  repo: RepoSlug;
  runner: string;
  running: boolean;
  lastPullAt: number | null;
  lastError: { code: KiboErrorCode; message: string } | null;
  imported: number;
  resumeAt: number | null;
};
export type OutboxError = { outboxId: number; ticketId: string; code: KiboErrorCode; message: string };
export type SyncState = { bindings: BindingState[]; pending: string[]; errors: OutboxError[] };
export type SyncReport = {
  pulled: number;
  created: number;
  updated: number;
  pushed: number;
  conflicts: number;
};

export const IntegrationEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("integrations") }),
  z.object({
    type: z.literal("sync"),
    projectId: z.string(),
    bindingId: z.string(),
    imported: z.number().int().nonnegative(),
    running: z.boolean(),
  }),
  z.object({
    type: z.literal("sync.conflict"),
    projectId: z.string(),
    ticketKey: z.string(),
    field: z.enum(["title", "description", "statusId"]),
  }),
  z.object({ type: z.literal("ci"), projectId: z.string() }),
  z.object({ type: z.literal("notice"), title: z.string().min(1).max(200), body: z.string().max(1000) }),
]);
export type IntegrationEvent = z.infer<typeof IntegrationEvent>;
