import { z } from "zod";

export const DOMAIN_COLORS = [
  "#14B8A6",
  "#6366F1",
  "#EC4899",
  "#B45309",
  "#64748B",
  "#84CC16",
  "#D946EF",
] as const;

export const DomainInput = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type DomainInput = z.infer<typeof DomainInput>;

export const Domain = DomainInput.extend({ id: z.string().min(1) });
export type Domain = z.infer<typeof Domain>;

export const GuidelinePath = z
  .string()
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*\.md$/);

export const GuidelineOwner = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("workspace") }),
  z.object({ scope: z.literal("project"), projectId: z.string().min(1) }),
  z.object({ scope: z.literal("domain"), domainId: z.string().min(1) }),
]);
export type GuidelineOwner = z.infer<typeof GuidelineOwner>;
export type GuidelineScope = GuidelineOwner["scope"];

export const GuidelineContent = z.string().max(100_000);

export const Guideline = z.object({
  id: z.string().min(1),
  owner: GuidelineOwner,
  path: GuidelinePath,
  content: GuidelineContent,
});
export type Guideline = z.infer<typeof Guideline>;

const Id = z.string().min(1);

export const WorkspaceName = z.string().trim().min(1).max(40);
export const WorkspaceDescription = z.string().trim().max(500);
export const WorkspacePatch = z
  .object({ name: WorkspaceName.optional(), description: WorkspaceDescription.nullable().optional() })
  .strict()
  .refine((p) => p.name !== undefined || p.description !== undefined, { message: "empty patch" });
export type WorkspacePatch = z.infer<typeof WorkspacePatch>;

export const ConfigCommand = z.discriminatedUnion("method", [
  z.object({ method: z.literal("createDomain"), domain: DomainInput }),
  z.object({ method: z.literal("updateDomain"), domainId: Id, patch: DomainInput.partial() }),
  z.object({ method: z.literal("deleteDomain"), domainId: Id }),
  z.object({
    method: z.literal("addGuideline"),
    owner: GuidelineOwner,
    path: GuidelinePath,
    content: GuidelineContent,
  }),
  z.object({
    method: z.literal("updateGuideline"),
    owner: GuidelineOwner,
    guidelineId: Id,
    path: GuidelinePath.optional(),
    content: GuidelineContent.optional(),
  }),
  z.object({ method: z.literal("removeGuideline"), owner: GuidelineOwner, guidelineId: Id }),
  z.object({ method: z.literal("updateWorkspace"), patch: WorkspacePatch }),
]);
export type ConfigCommand = z.infer<typeof ConfigCommand>;

export type ConfigResult = {
  createDomain: Domain;
  updateDomain: Domain;
  deleteDomain: null;
  addGuideline: Guideline;
  updateGuideline: Guideline;
  removeGuideline: null;
  updateWorkspace: { name: string | null; description: string | null };
};

export type WorkspaceConfig = {
  domains: Domain[];
  guidelines: Guideline[];
  domainUsage: Record<string, number>;
  workspaceName: string | null;
  workspaceDescription: string | null;
  workspaceIcon: string | null;
};

export const HostSettings = z.object({
  hostSlots: z.number().int().min(1).max(32),
  cpuThreshold: z.number().int().min(10).max(100),
  ramThreshold: z.number().int().min(10).max(100),
  paused: z.boolean(),
});
export type HostSettings = z.infer<typeof HostSettings>;

export const DEFAULT_CPU_THRESHOLD = 85;
export const DEFAULT_RAM_THRESHOLD = 90;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
