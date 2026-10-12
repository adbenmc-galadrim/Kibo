import { z } from "zod";
import {
  type Agent,
  AgentCreateInput,
  AgentFile,
  AgentName,
  type AgentPreview,
  AgentRef,
  AgentSettingsPatch,
  type AgentSummary,
  type MigrationNotice,
} from "./agent";
import { type FileVersion, FileVersionKind, type SaveResult } from "./file-version";
import { NodeId, Sha256 } from "./ids";

const ProjectId = z.string().min(1);
const VersionFile = z.string().min(1).max(512);

export const AGENT_RPC = [
  z.object({ method: z.literal("agents.list"), projectId: ProjectId.optional() }),
  z.object({ method: z.literal("agents.read"), ref: AgentRef }),
  AgentCreateInput.extend({ method: z.literal("agents.create") }),
  z.object({ method: z.literal("agents.save"), ref: AgentRef, file: AgentFile, baseHash: Sha256.nullable() }),
  z.object({ method: z.literal("agents.delete"), ref: AgentRef }),
  z.object({ method: z.literal("agents.settings"), ref: AgentRef, patch: AgentSettingsPatch }),
  z.object({ method: z.literal("agents.rename"), ref: AgentRef, name: AgentName }),
  z.object({
    method: z.literal("agents.preview"),
    ref: AgentRef,
    projectId: ProjectId.optional(),
    ticketId: NodeId.optional(),
  }),
  z.object({
    method: z.literal("fileVersions.list"),
    kind: FileVersionKind,
    ref: z.string().min(1).max(200),
    file: VersionFile.optional(),
  }),
  z.object({ method: z.literal("fileVersions.read"), id: z.string().min(1) }),
  z.object({ method: z.literal("fileVersions.restore"), id: z.string().min(1), baseHash: Sha256.nullable() }),
] as const;

export type AgentRpcRequest = z.infer<(typeof AGENT_RPC)[number]>;
export type AgentRpcResult = {
  "agents.list": { agents: AgentSummary[]; notices: MigrationNotice[]; partialWatch: boolean };
  "agents.read": Agent;
  "agents.create": { agent: Agent; missingSubagents: string[] };
  "agents.save": SaveResult<Agent>;
  "agents.delete": { ok: true };
  "agents.settings": Agent;
  "agents.rename": Agent;
  "agents.preview": AgentPreview;
  "fileVersions.list": FileVersion[];
  "fileVersions.read": { version: FileVersion; content: string | null };
  "fileVersions.restore": SaveResult<FileVersion>;
};

const AGENT_METHODS: ReadonlySet<string> = new Set(AGENT_RPC.map((schema) => schema.shape.method.value));

export const isAgentRequest = (req: { method: string }): req is AgentRpcRequest =>
  AGENT_METHODS.has(req.method);
