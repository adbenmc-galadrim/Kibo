import {
  AGENT_RPC,
  type AgentPreview,
  type AgentRef,
  AgentRef as AgentRefSchema,
  type AgentRpcRequest,
  type FileVersion,
  isAgentRequest,
  KiboError,
  parseAgentRef,
  type SaveResult,
} from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { AgentFilesService } from "./service";

export type AgentPreviewRequest = Extract<AgentRpcRequest, { method: "agents.preview" }>;
export type AgentFilesRpcData = {
  viewer(): string;
  assertWritable(projectId: string): void;
  restoreSkill?(id: string, baseHash: string | null, by: string): Promise<SaveResult<FileVersion>>;
};

const METHODS = AGENT_RPC.map((schema) => schema.shape.method.value);

function projectOf(ref: string): string | null {
  const parsed = AgentRefSchema.safeParse(ref);
  if (!parsed.success) return null;
  const agent = parseAgentRef(parsed.data);
  return agent.scope === "project" ? agent.projectId : null;
}

function skillProjectOf(ref: string): string | null {
  const [scope, projectId] = ref.split(":");
  return scope === "project" && projectId ? projectId : null;
}

export function agentFilesRpc(
  service: AgentFilesService,
  preview: (req: AgentPreviewRequest) => Promise<AgentPreview>,
  data: AgentFilesRpcData,
): RpcExtension {
  const writer = (ctx: RpcContext, ref: AgentRef | null, projectId: string | null = null): string => {
    requireLocal(ctx);
    const project = projectId ?? (ref === null ? null : projectOf(ref));
    if (project !== null) data.assertWritable(project);
    return data.viewer();
  };

  const restore = async (req: { id: string; baseHash: string | null }, ctx: RpcContext) => {
    requireLocal(ctx);
    const { version } = service.versions.read(req.id);
    const by = writer(
      ctx,
      null,
      version.kind === "agents" ? projectOf(version.ref) : skillProjectOf(version.ref),
    );
    if (version.kind === "agents") return service.versions.restore(req.id, req.baseHash, by);
    if (!data.restoreSkill) throw new KiboError("INVALID_INPUT", "skill versions are not served here");
    return data.restoreSkill(req.id, req.baseHash, by);
  };

  return {
    methods: METHODS,
    async handle(req, ctx) {
      if (!isAgentRequest(req)) throw new KiboError("INTERNAL", `${req.method} is not an agent method`);
      switch (req.method) {
        case "agents.list":
          await service.catalog.refresh();
          return service.list(req.projectId ?? null);
        case "agents.read":
          return service.read(req.ref);
        case "agents.create": {
          const { method: _method, ...input } = req;
          return service.create(
            input,
            writer(ctx, null, input.scope === "project" ? (input.projectId ?? null) : null),
          );
        }
        case "agents.save":
          return service.save(req.ref, req.file, req.baseHash, writer(ctx, req.ref));
        case "agents.delete":
          await service.delete(req.ref, writer(ctx, req.ref));
          return { ok: true };
        case "agents.settings":
          writer(ctx, req.ref);
          service.settings(req.ref, req.patch);
          return service.read(req.ref);
        case "agents.rename":
          return service.rename(req.ref, req.name, writer(ctx, req.ref));
        case "agents.preview":
          return preview(req);
        case "fileVersions.list":
          return service.versions.list(req.kind, req.ref, req.file);
        case "fileVersions.read":
          return service.versions.read(req.id);
        case "fileVersions.restore":
          return restore(req, ctx);
      }
    },
  };
}
