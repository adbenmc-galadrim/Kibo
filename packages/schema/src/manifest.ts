import { z } from "zod";
import { ConfigSchema } from "./config";
import { ComponentFormat, FORMAT_PREFERENCE } from "./format";
import { GITHUB_SECRET_HOSTS, IntegrationSecretNameSchema } from "./integrations";
import { NetRule } from "./net";
import { SemVer } from "./semver";

export const BuiltinEntityType = z.enum(["ticket", "status", "link", "page", "run", "note", "ci_run"]);
export type BuiltinEntityType = z.infer<typeof BuiltinEntityType>;
export const EntityType = BuiltinEntityType;
export type EntityType = BuiltinEntityType;

export const ComponentId = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/);
export type ComponentId = z.infer<typeof ComponentId>;
export const ComponentKind = z.enum(["widget", "view", "both", "adapter"]);
export type ComponentKind = z.infer<typeof ComponentKind>;

export const ComponentManifest = z.object({
  id: ComponentId,
  version: SemVer,
  kind: ComponentKind,
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
          name: IntegrationSecretNameSchema,
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
  formats: z.array(ComponentFormat).min(1).max(5).optional(),
});
export type ComponentManifest = z.infer<typeof ComponentManifest>;
export type ComponentManifestInput = z.input<typeof ComponentManifest>;

type FormatFields = Pick<ComponentManifest, "kind" | "formats">;

export const DEFAULT_FORMATS: Readonly<Record<ComponentKind, readonly ComponentFormat[]>> = {
  widget: ["medium", "large", "half"],
  view: ["full"],
  both: ["medium", "large", "half", "full"],
  adapter: [],
};

export const formatsOf = (m: FormatFields): ComponentFormat[] => [...(m.formats ?? DEFAULT_FORMATS[m.kind])];

export const defaultFormatOf = (m: FormatFields): ComponentFormat => {
  const declared = formatsOf(m);
  return FORMAT_PREFERENCE.find((f) => declared.includes(f)) ?? "half";
};

export const formatIssue = (m: FormatFields): string | null => {
  if (m.formats === undefined) return null;
  if (new Set(m.formats).size !== m.formats.length) return "INVALID_MANIFEST: formats must be unique";
  if (m.kind === "adapter") return "INVALID_MANIFEST: an adapter has no format";
  if (m.kind === "view" && !m.formats.includes("full")) {
    return "INVALID_MANIFEST: a view declares the full format";
  }
  if (m.kind === "widget" && m.formats.every((f) => f === "full")) {
    return "INVALID_MANIFEST: a widget declares a format other than full";
  }
  return null;
};
