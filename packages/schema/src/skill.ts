import { z } from "zod";
import type { SkillId } from "./skill-id";

export { SkillId } from "./skill-id";

export const SkillSource = z.enum(["user", "project", "plugin"]);
export type SkillSource = z.infer<typeof SkillSource>;

export const SKILL_BODY_MAX = 100_000;
export const SKILL_ASSET_TEXT_MAX = 1_048_576;
export const SKILL_TEXT_EXTENSIONS = [
  ".md",
  ".txt",
  ".js",
  ".ts",
  ".sh",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".dot",
  ".csv",
] as const;

export const SkillFrontmatter = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  disableModelInvocation: z.boolean().optional(),
  userInvocable: z.boolean().optional(),
  extra: z.string().default(""),
  extraKeys: z.array(z.string()).default([]),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;

export const SkillFile = z.object({ frontmatter: SkillFrontmatter, body: z.string().max(SKILL_BODY_MAX) });
export type SkillFile = z.infer<typeof SkillFile>;

export type SkillAsset = { path: string; size: number; text: boolean };
export type SkillUsage = {
  last: { runId: string; ticketKey: string | null; at: number } | null;
  runs30d: number;
};

export type Skill = {
  id: SkillId;
  source: SkillSource;
  projectId: string | null;
  plugin: { name: string; version: string } | null;
  name: string;
  description: string;
  path: string;
  file: SkillFile | null;
  problem: string | null;
  hash: string | null;
  readOnly: boolean;
  shadowedBy: SkillId | null;
  files: SkillAsset[];
  usage: SkillUsage;
  reviews: { open: number };
  modifiedAt: number | null;
};
