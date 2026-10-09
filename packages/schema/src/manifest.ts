import { z } from "zod";
import { Capability } from "./capability";
import { ConfigSchema } from "./config";
import {
  ComponentFormat,
  FORMAT_PREFERENCE,
  FORMAT_SIZES,
  type FormatSize,
  GRID_COLUMNS,
  MAX_GRID_ROWS,
} from "./format";
import { GITHUB_SECRET_HOSTS, IntegrationSecretNameSchema } from "./integrations";
import { NetRule } from "./net";
import { SemVer } from "./semver";

export const BuiltinEntityType = z.enum([
  "ticket",
  "status",
  "link",
  "page",
  "run",
  "note",
  "ci_run",
  "question",
]);
export type BuiltinEntityType = z.infer<typeof BuiltinEntityType>;
export const EntityType = BuiltinEntityType;
export type EntityType = BuiltinEntityType;

export const EmbedHost = z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/);

export const ComponentId = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/);
export type ComponentId = z.infer<typeof ComponentId>;
export const ComponentKind = z.enum(["widget", "view", "both", "adapter"]);
export type ComponentKind = z.infer<typeof ComponentKind>;

const Cells = z.object({
  w: z.number().int().min(1).max(GRID_COLUMNS),
  h: z.number().int().min(1).max(MAX_GRID_ROWS),
});
export const SizeSpec = z.object({ min: Cells.optional(), max: Cells.optional() });

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
  size: SizeSpec.optional(),
  capabilities: z.array(Capability).default([]),
  embeds: z.array(EmbedHost).default([]),
  selection: z.boolean().default(false),
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

export type SizeLimits = { min: FormatSize; max: FormatSize };
export const DEFAULT_SIZE_LIMITS: SizeLimits = { min: { w: 2, h: 2 }, max: { w: 12, h: 12 } };
type SizeFields = Pick<ComponentManifest, "size">;

export const sizeLimitsOf = (m: Partial<SizeFields>): SizeLimits => ({
  min: m.size?.min ?? DEFAULT_SIZE_LIMITS.min,
  max: m.size?.max ?? DEFAULT_SIZE_LIMITS.max,
});

export const clampSize = (size: FormatSize, limits: SizeLimits): FormatSize => ({
  w: Math.min(limits.max.w, Math.max(limits.min.w, size.w)),
  h: Math.min(limits.max.h, Math.max(limits.min.h, size.h)),
});

const within = (size: FormatSize, limits: SizeLimits): boolean =>
  size.w >= limits.min.w && size.h >= limits.min.h && size.w <= limits.max.w && size.h <= limits.max.h;

export const sizeIssue = (m: Partial<SizeFields> & FormatFields): string | null => {
  const limits = sizeLimitsOf(m);
  if (limits.min.w > limits.max.w || limits.min.h > limits.max.h)
    return "INVALID_MANIFEST: size.min exceeds size.max";
  if (m.size === undefined) return null;
  const outside = formatsOf(m).find((f) => !within(FORMAT_SIZES[f], limits));
  return outside === undefined ? null : `INVALID_MANIFEST: format ${outside} is outside size limits`;
};
