import {
  type Actor,
  isSkillRequest,
  KiboError,
  SKILL_RPC,
  type SkillId,
  type SkillRpcRequest,
} from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { SkillReviews } from "./reviews";
import type { SkillsService } from "./service";

export type SkillRpcData = { viewer(): string; assertWritable(projectId: string): void };

const METHODS = SKILL_RPC.map((schema) => schema.shape.method.value);

function guardWrite(ctx: RpcContext, data: SkillRpcData, projectId: string | null | undefined): void {
  requireLocal(ctx);
  if (projectId) data.assertWritable(projectId);
}

const projectOf = (service: SkillsService, id: SkillId): string | null => {
  const skill = service.byId(id);
  if (!skill) throw new KiboError("NOT_FOUND", `skill ${id} not found`);
  return skill.projectId;
};

async function handleSkill(
  service: SkillsService,
  reviews: SkillReviews,
  data: SkillRpcData,
  req: SkillRpcRequest,
  ctx: RpcContext,
): Promise<unknown> {
  const by = () => data.viewer();
  switch (req.method) {
    case "skills.list":
      await service.refresh();
      return service.list(req.projectId ?? null);
    case "skills.read":
      return service.read(req.id, req.file);
    case "skills.assets":
      return service.assets(req.id);
    case "skillReviews.list":
      return reviews.list({ skillId: req.skillId, runId: req.runId });
    case "skills.save":
      guardWrite(ctx, data, projectOf(service, req.id));
      return service.save({ ...req, by: by() });
    case "skills.create": {
      guardWrite(ctx, data, req.source === "project" ? (req.projectId ?? null) : null);
      const { method: _method, ...input } = req;
      return service.create(input, by());
    }
    case "skills.copy":
      guardWrite(ctx, data, req.to.source === "project" ? (req.to.projectId ?? null) : null);
      return service.copy(req.id, req.to, req.name, by());
    case "skills.delete":
      guardWrite(ctx, data, projectOf(service, req.id));
      await service.delete(req.id, by());
      return { ok: true };
    case "skills.removeAsset":
      guardWrite(ctx, data, projectOf(service, req.id));
      await service.removeAsset(req.id, req.file, by());
      return { ok: true };
    case "skillReviews.decide": {
      const review = reviews.store.get(req.id);
      if (!review) throw new KiboError("NOT_FOUND", `skill review ${req.id} not found`);
      guardWrite(ctx, data, review.projectId);
      const actor: Actor = { kind: "human", ref: by() };
      return reviews.decide(req.id, req.decision, actor);
    }
  }
}

export function skillsRpc(service: SkillsService, reviews: SkillReviews, data: SkillRpcData): RpcExtension {
  return {
    methods: METHODS,
    async handle(req, ctx) {
      if (!isSkillRequest(req)) throw new KiboError("INTERNAL", `${req.method} is not a skill method`);
      return handleSkill(service, reviews, data, req, ctx);
    },
  };
}
