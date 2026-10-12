import { z } from "zod";
import type { AgentRef } from "./agent";
import type { SaveResult } from "./file-version";
import { Sha256 } from "./ids";
import {
  type Skill,
  type SkillAsset,
  SkillCreateInput,
  SkillId,
  SkillName,
  type SkillReview,
  SkillSource,
} from "./skill";

const ProjectId = z.string().min(1);
export const SkillFilePath = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith("/") && !p.split("/").some((part) => part === ".." || part === ""), {
    message: "relative path without ..",
  });

export const SkillScope = z.object({
  scope: SkillSource.optional(),
  projectId: ProjectId.optional(),
  plugin: z.string().min(1).max(128).optional(),
});
export type SkillScope = z.infer<typeof SkillScope>;

export const SKILL_RPC = [
  z.object({ method: z.literal("skills.list"), projectId: ProjectId.optional() }),
  SkillScope.extend({ method: z.literal("skills.read"), id: SkillId, file: SkillFilePath.optional() }),
  SkillScope.extend({
    method: z.literal("skills.save"),
    id: SkillId,
    file: SkillFilePath.optional(),
    content: z.string().max(1_048_576),
    baseHash: Sha256.nullable(),
    reviewId: z.string().min(1).optional(),
  }),
  SkillCreateInput.extend({ method: z.literal("skills.create") }),
  z.object({
    method: z.literal("skills.copy"),
    id: SkillId,
    from: SkillScope.optional(),
    to: z.object({ source: z.enum(["user", "project"]), projectId: ProjectId.optional() }),
    name: SkillName.optional(),
  }),
  SkillScope.extend({ method: z.literal("skills.delete"), id: SkillId }),
  SkillScope.extend({ method: z.literal("skills.assets"), id: SkillId }),
  SkillScope.extend({ method: z.literal("skills.removeAsset"), id: SkillId, file: SkillFilePath }),
  z.object({
    method: z.literal("skillReviews.list"),
    skillId: SkillId.optional(),
    runId: z.string().min(1).optional(),
  }),
  z.object({
    method: z.literal("skillReviews.decide"),
    id: z.string().min(1),
    decision: z.literal("ignore"),
  }),
] as const;

export type SkillRpcRequest = z.infer<(typeof SKILL_RPC)[number]>;
export type SkillRpcResult = {
  "skills.list": { skills: Skill[]; partialWatch: boolean };
  "skills.read": { content: string; hash: string; modifiedAt: number; file: string };
  "skills.save": SaveResult<{ hash: string; modifiedAt: number }>;
  "skills.create": Skill;
  "skills.copy": { skill: Skill; citedBy: AgentRef[] };
  "skills.delete": { ok: true };
  "skills.assets": SkillAsset[];
  "skills.removeAsset": { ok: true };
  "skillReviews.list": SkillReview[];
  "skillReviews.decide": SkillReview;
};

const SKILL_METHODS: ReadonlySet<string> = new Set(SKILL_RPC.map((schema) => schema.shape.method.value));

export const isSkillRequest = (req: { method: string }): req is SkillRpcRequest =>
  SKILL_METHODS.has(req.method);
