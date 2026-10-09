import { z } from "zod";
import { ProjectKey } from "./ids";
import { WorktreeSettings } from "./worktree";

export const ProjectMeta = z.object({
  id: z.string().min(1),
  key: ProjectKey,
  name: z.string().trim().min(1),
  folder: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  worktree: WorktreeSettings.nullable().default(null),
});
export type ProjectMeta = z.infer<typeof ProjectMeta>;

export const ProjectPatch = z
  .object({
    name: ProjectMeta.shape.name.optional(),
    color: ProjectMeta.shape.color.optional(),
    folder: z.string().min(1).max(4096).nullable().optional(),
    worktree: WorktreeSettings.nullable().optional(),
  })
  .strict()
  .refine(
    (p) =>
      p.name !== undefined || p.color !== undefined || p.folder !== undefined || p.worktree !== undefined,
    {
      message: "empty patch",
    },
  );
export type ProjectPatch = z.infer<typeof ProjectPatch>;
