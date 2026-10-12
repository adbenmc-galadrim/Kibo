import { z } from "zod";
import type { McpToolSpec } from "./mcp-spec";
import type { Actor } from "./question";
import { SkillId } from "./skill-id";

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

export const SkillName = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);

export const SkillCreateInput = z.object({
  source: z.enum(["user", "project"]),
  projectId: z.string().optional(),
  name: SkillName,
  description: z.string().min(1).max(1_024),
});
export type SkillCreateInput = z.infer<typeof SkillCreateInput>;

export const SKILL_REVIEW_TOOL_NAME = "skill_review";
export const SKILL_REVIEW_TOOL = `mcp__kibo__${SKILL_REVIEW_TOOL_NAME}`;
export const SHARED_TOOL_NAMES = [SKILL_REVIEW_TOOL_NAME] as const;
export const isSharedToolName = (name: string): boolean => SHARED_TOOL_NAMES.some((tool) => tool === name);

export const SKILL_NOTE_MAX = 300;
export const SKILL_NOTE_LINES_MAX = 3;
export const SKILL_REVIEWS_PER_CALL_MAX = 20;

export const SkillVerdict = z.enum(["ok", "improve"]);
export type SkillVerdict = z.infer<typeof SkillVerdict>;

export const SkillReviewInput = z.object({
  skill: SkillId,
  verdict: SkillVerdict,
  note: z
    .string()
    .min(1)
    .max(SKILL_NOTE_MAX)
    .refine((n) => n.split("\n").length <= SKILL_NOTE_LINES_MAX, "three lines at most"),
  suggestion: z.object({ content: z.string().max(SKILL_BODY_MAX) }).optional(),
});
export type SkillReviewInput = z.infer<typeof SkillReviewInput>;

export const SkillReviewCall = z.object({
  reviews: z.array(SkillReviewInput).min(1).max(SKILL_REVIEWS_PER_CALL_MAX),
});
export type SkillReviewCall = z.infer<typeof SkillReviewCall>;

export const SKILL_REVIEW_SPEC: McpToolSpec = {
  name: SKILL_REVIEW_TOOL_NAME,
  description:
    "Before finishing, review each skill you used in this run: verdict ok or improve, a note of three lines at most (what helped, what was missing, what you would change), and optionally the full corrected SKILL.md content as suggestion. Nothing is modified without the user's validation.",
  inputSchema: {
    type: "object",
    properties: {
      reviews: {
        type: "array",
        minItems: 1,
        maxItems: SKILL_REVIEWS_PER_CALL_MAX,
        items: {
          type: "object",
          properties: {
            skill: { type: "string", description: "Id of the skill as passed to the Skill tool." },
            verdict: { type: "string", enum: SkillVerdict.options },
            note: { type: "string", maxLength: SKILL_NOTE_MAX, description: "Three lines at most." },
            suggestion: {
              type: "object",
              properties: { content: { type: "string", description: "Full proposed SKILL.md." } },
              required: ["content"],
            },
          },
          required: ["skill", "verdict", "note"],
        },
      },
    },
    required: ["reviews"],
  },
};

export const SkillReviewStatus = z.enum(["new", "integrated", "ignored", "replaced"]);
export type SkillReviewStatus = z.infer<typeof SkillReviewStatus>;

export type SkillReviewRow = {
  id: string;
  runId: string;
  runLabel: string;
  agentName: string;
  projectId: string | null;
  ticketId: string | null;
  ticketKey: string | null;
  skillId: SkillId;
  skillPath: string | null;
  baseHash: string | null;
  verdict: SkillVerdict;
  note: string;
  suggestion: string | null;
  createdAt: number;
};
export type SkillReviewEvent = {
  type: "integrated" | "ignored" | "replaced";
  by: Actor | null;
  at: number;
  versionId: string | null;
};
export type SkillReview = SkillReviewRow & {
  status: SkillReviewStatus;
  decidedAt: number | null;
  decidedBy: Actor | null;
  versionId: string | null;
};

export function foldSkillReview(row: SkillReviewRow, events: readonly SkillReviewEvent[]): SkillReview {
  const [first] = events;
  if (!first) return { ...row, status: "new", decidedAt: null, decidedBy: null, versionId: null };
  return { ...row, status: first.type, decidedAt: first.at, decidedBy: first.by, versionId: first.versionId };
}
