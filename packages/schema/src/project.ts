import { z } from "zod";
import { ProjectDelivery } from "./delivery";
import { ProjectKey } from "./ids";
import { StorybookSettings } from "./storybook";
import { TrackingSettings } from "./tracking-settings";
import { WorktreeSettings } from "./worktree";

export const PROJECT_DESCRIPTION_MAX = 200;
const ProjectDescription = z.string().trim().max(PROJECT_DESCRIPTION_MAX);
export const PROJECT_CLIENT_MAX = 60;
export const ProjectClient = z.string().trim().min(1).max(PROJECT_CLIENT_MAX);

export const ProjectMeta = z.object({
  id: z.string().min(1),
  key: ProjectKey,
  name: z.string().trim().min(1),
  folder: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  worktree: WorktreeSettings.nullable().default(null),
  storybook: StorybookSettings.nullable().default(null),
  delivery: ProjectDelivery.nullable().default(null),
  tracking: TrackingSettings.nullable().default(null),
  description: ProjectDescription.nullable().default(null),
  client: ProjectClient.nullable().default(null),
});
export type ProjectMeta = z.infer<typeof ProjectMeta>;

export const ProjectPatch = z
  .object({
    name: ProjectMeta.shape.name.optional(),
    color: ProjectMeta.shape.color.optional(),
    folder: z.string().min(1).max(4096).nullable().optional(),
    worktree: WorktreeSettings.nullable().optional(),
    storybook: StorybookSettings.nullable().optional(),
    delivery: ProjectDelivery.nullable().optional(),
    tracking: TrackingSettings.nullable().optional(),
    description: ProjectDescription.nullable().optional(),
    client: ProjectClient.nullable().optional(),
  })
  .strict()
  .refine((p) => Object.values(p).some((v) => v !== undefined), { message: "empty patch" });
export type ProjectPatch = z.infer<typeof ProjectPatch>;
