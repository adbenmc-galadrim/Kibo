import { z } from "zod";
import { ConfigSchema } from "./config";
import { NetRule } from "./net";
import { SemVer } from "./semver";

export const BuiltinEntityType = z.enum(["ticket", "status", "link", "page", "run", "note"]);
export type BuiltinEntityType = z.infer<typeof BuiltinEntityType>;
export const EntityType = BuiltinEntityType;
export type EntityType = BuiltinEntityType;

export const ComponentManifest = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/),
  version: SemVer,
  kind: z.enum(["widget", "view", "both"]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean().default(false),
  net: z.array(NetRule).default([]),
  configSchema: ConfigSchema.optional(),
  configVersion: z.number().int().nonnegative().default(0),
  changes: z.array(z.string().min(1)).default([]),
  sdk: z.literal(1).default(1),
});
export type ComponentManifest = z.infer<typeof ComponentManifest>;
export type ComponentManifestInput = z.input<typeof ComponentManifest>;
