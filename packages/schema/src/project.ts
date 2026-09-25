import { z } from "zod";
import { ProjectKey } from "./ids";

export const ProjectMeta = z.object({
  id: z.string().min(1),
  key: ProjectKey,
  name: z.string().trim().min(1),
  folder: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type ProjectMeta = z.infer<typeof ProjectMeta>;
