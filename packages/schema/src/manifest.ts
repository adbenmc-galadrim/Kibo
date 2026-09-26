import { z } from "zod";
import { ConfigSchema } from "./config";
import { GITHUB_SECRET_HOSTS, SecretNameSchema } from "./integrations";
import { NetRule } from "./net";
import { SemVer } from "./semver";

export const BuiltinEntityType = z.enum(["ticket", "status", "link", "page", "run", "note", "ci_run"]);
export type BuiltinEntityType = z.infer<typeof BuiltinEntityType>;
export const EntityType = BuiltinEntityType;
export type EntityType = BuiltinEntityType;

export const ComponentManifest = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/),
  version: SemVer,
  kind: z.enum(["widget", "view", "both", "adapter"]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean().default(false),
  net: z.array(NetRule).default([]),
  secrets: z
    .array(
      z
        .object({
          name: SecretNameSchema,
          hosts: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).min(1),
        })
        .refine((s) => s.name !== "github" || s.hosts.every((h) => GITHUB_SECRET_HOSTS.includes(h)), {
          message: "INVALID_MANIFEST: the github secret is reserved to api.github.com and uploads.github.com",
          path: ["hosts"],
        }),
    )
    .default([]),
  mcp: z
    .array(z.union([z.string().regex(/^[a-z0-9-]+(\/[A-Za-z0-9_.-]+)?$/), z.literal("{config.server}")]))
    .default([]),
  configSchema: ConfigSchema.optional(),
  configVersion: z.number().int().nonnegative().default(0),
  changes: z.array(z.string().min(1)).default([]),
  sdk: z.literal(1).default(1),
});
export type ComponentManifest = z.infer<typeof ComponentManifest>;
export type ComponentManifestInput = z.input<typeof ComponentManifest>;
