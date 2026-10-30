import { z } from "zod";
import type { KiboErrorCode } from "./errors";
import { Sha256 } from "./ids";
import type { ComponentManifest } from "./manifest";
import { GrantedPermissions } from "./permissions";
import { SemVer } from "./semver";

export const BUILTIN_IDS = ["kanban", "graph", "mockup", "questions", "planning", "overview"] as const;
const BUILTIN: readonly string[] = BUILTIN_IDS;
export const isBuiltinId = (id: string): boolean => BUILTIN.includes(id);

export const TrustLevel = z.enum(["builtin", "trusted", "sandboxed"]);
export type TrustLevel = z.infer<typeof TrustLevel>;
export const ApprovableTrust = z.enum(["trusted", "sandboxed"]);
export type ApprovableTrust = z.infer<typeof ApprovableTrust>;
export const ComponentOrigin = z.enum(["kibo", "user", "ai", "marketplace"]);
export type ComponentOrigin = z.infer<typeof ComponentOrigin>;

export const RegistryVersion = z.object({
  version: SemVer,
  hash: Sha256,
  origin: ComponentOrigin,
  trust: TrustLevel.nullable(),
  approvedHash: Sha256.nullable(),
  granted: GrantedPermissions,
  publishedAt: z.number().int(),
  autoUpdate: z.boolean().default(false),
  source: z
    .object({ sourceId: z.string().min(1), publisherKey: z.string().min(1) })
    .nullable()
    .default(null),
  revoked: z.object({ reason: z.string(), at: z.number().int() }).nullable().default(null),
});
export type RegistryVersion = z.infer<typeof RegistryVersion>;

export const RegistryEntry = z.object({
  title: z.string().min(1),
  versions: z.record(SemVer, RegistryVersion),
});
export type RegistryEntry = z.infer<typeof RegistryEntry>;

export type MarketTrustInfo = {
  publisherName: string;
  verified: boolean;
  sourceName: string;
  newPublisher: boolean;
};
export type TrustPreview = {
  id: string;
  title: string;
  version: string;
  hash: string;
  origin: ComponentOrigin;
  permissions: GrantedPermissions;
  market: MarketTrustInfo | null;
};

export const isActive = (v: Pick<RegistryVersion, "trust" | "hash" | "approvedHash">): boolean =>
  v.trust !== null && v.approvedHash === v.hash;

export const shortHash = (hash: string): string => `${hash.slice(0, 4)}…${hash.slice(-4)}`;

export const USED_MARKER = "::kibo-used::";

const Step = z.object({ ok: z.boolean(), errors: z.array(z.string()) });
export const ValidationReport = z.object({
  manifest: Step,
  imports: Step,
  typecheck: Step,
  tests: z.object({
    ok: z.boolean(),
    passed: z.number().int(),
    failed: z.number().int(),
    output: z.string(),
  }),
  conformance: Step,
  permissions: z.object({
    declared: z.array(z.string()),
    used: z.array(z.string()),
    missing: z.array(z.string()),
    unused: z.array(z.string()),
    errors: z.array(z.string()),
  }),
  hash: Sha256.nullable(),
  ok: z.boolean(),
});
export type ValidationReport = z.infer<typeof ValidationReport>;

export type ComponentUsage = {
  projectId: string;
  projectName: string;
  pageId: string;
  pageTitle: string;
  instanceId: string;
};
export type ComponentVersionSummary = {
  version: string;
  hash: string | null;
  trust: TrustLevel | null;
  origin: ComponentOrigin;
  active: boolean;
  tampered: boolean;
  manifest: ComponentManifest | null;
  usages: ComponentUsage[];
  revoked: { reason: string; at: number } | null;
  backend: boolean;
};
export type ComponentSummary = {
  id: string;
  title: string;
  builtin: boolean;
  versions: ComponentVersionSummary[];
};
export type DraftSummary = {
  id: string;
  title: string;
  version: string;
  hash: string | null;
  validated: boolean;
  publishedVersion: string | null;
};
export type PublishUsage = ComponentUsage & { version: string };
export type PublishPreview = {
  id: string;
  title: string;
  from: string | null;
  to: string;
  hash: string | null;
  status: "new" | "update" | "unchanged";
  usages: PublishUsage[];
  changes: string[];
  newPermissions: string[];
  migration: { from: number; to: number } | null;
  validation: ValidationReport;
};
export type PublishResult = {
  version: RegistryVersion;
  needsApproval: boolean;
  updated: string[];
  failed: {
    instanceId: string;
    projectName: string;
    pageTitle: string;
    code: KiboErrorCode;
    message: string;
  }[];
};
export type RuntimeInfo = { sandboxOrigin: string };
