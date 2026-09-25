import { z } from "zod";

export const EntityType = z.enum(["ticket", "status", "link", "page"]);
export type EntityType = z.infer<typeof EntityType>;

export const ComponentManifest = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  kind: z.enum(["widget", "view", "both"]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  reads: z.array(EntityType),
  writes: z.array(EntityType),
  configSchema: z.record(z.string(), z.unknown()).optional(),
});
export type ComponentManifest = z.infer<typeof ComponentManifest>;
