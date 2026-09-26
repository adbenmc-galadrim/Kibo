import { z } from "zod";
import type { FileDiff } from "./code";
import {
  ApprovableTrust,
  type PublishPreview,
  type PublishResult,
  type RegistryVersion,
  type ValidationReport,
} from "./component";
import { ComponentManifest } from "./manifest";
import { PageKind } from "./page";

export const Role = z.enum(["dev", "designer", "pm", "other"]);
export type Role = z.infer<typeof Role>;

export const StarterComponent = z.object({
  id: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type StarterComponent = z.infer<typeof StarterComponent>;

export const StarterPage = z.object({
  title: z.string().trim().min(1).max(40),
  kind: PageKind,
  components: z.array(StarterComponent).min(1),
});
export type StarterPage = z.infer<typeof StarterPage>;

export const StarterPlan = z.object({ pages: z.array(StarterPage).min(1).max(8) });
export type StarterPlan = z.infer<typeof StarterPlan>;

export const STARTER_TEXT_MAX = 500;
export const StarterText = z.string().trim().min(1).max(STARTER_TEXT_MAX);

const Version = ComponentManifest.shape.version;
export const DraftKind = z.enum(["widget", "view", "both"]);
export type DraftKind = z.infer<typeof DraftKind>;
export const DraftComponentId = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
export const DraftId = z.string().uuid();
export const DraftMode = z.enum(["create", "modify"]);
export type DraftMode = z.infer<typeof DraftMode>;
export const DraftStatus = z.enum([
  "describing",
  "generating",
  "validating",
  "failed",
  "review",
  "permissions",
  "done",
  "abandoned",
]);
export type DraftStatus = z.infer<typeof DraftStatus>;
export const DraftFailure = z.object({
  kind: z.enum(["run_failed", "run_cancelled", "validation", "config_changed", "interrupted"]),
  detail: z.string().nullable(),
});
export type DraftFailure = z.infer<typeof DraftFailure>;
export const DraftIncident = z.object({ kind: z.enum(["restored", "removed"]), path: z.string() });
export type DraftIncident = z.infer<typeof DraftIncident>;
export const MAX_DRAFT_ATTEMPTS = 3;

export const ComponentDraft = z.object({
  id: DraftId,
  componentId: z.string().min(1),
  mode: DraftMode,
  title: z.string().min(1),
  kind: DraftKind,
  withServer: z.boolean(),
  baseVersion: Version.nullable(),
  description: z.string(),
  runId: z.string().nullable(),
  sessionId: z.string().nullable(),
  status: DraftStatus,
  attempts: z.number().int().min(0).max(MAX_DRAFT_ATTEMPTS),
  failure: DraftFailure.nullable(),
  incidents: z.array(DraftIncident),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ComponentDraft = z.infer<typeof ComponentDraft>;

export const StartComponentDraftInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    id: DraftComponentId,
    title: z.string().trim().min(1).max(60),
    kind: DraftKind,
    withServer: z.boolean(),
    description: z.string().trim().min(20).max(2000),
  }),
  z.object({
    mode: z.literal("modify"),
    id: ComponentManifest.shape.id,
    description: z.string().trim().min(5).max(2000),
  }),
]);
export type StartComponentDraftInput = z.infer<typeof StartComponentDraftInput>;

export const DraftChanges = z.array(z.string().trim().min(1).max(200)).max(20);
export const ReviewComponentDraftInput = z.object({
  draftId: DraftId,
  version: Version,
  changes: DraftChanges,
});
export type ReviewComponentDraftInput = z.infer<typeof ReviewComponentDraftInput>;

export const FinalizeComponentDraftInput = z.object({
  draftId: DraftId,
  version: Version,
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  trust: ApprovableTrust,
  strategy: z.enum(["update-all", "new-version"]),
  target: z.object({ projectId: z.string().min(1), pageId: z.string().min(1) }).nullable(),
});
export type FinalizeComponentDraftInput = z.infer<typeof FinalizeComponentDraftInput>;

export type ComponentDraftDetails = ComponentDraft & {
  report: ValidationReport | null;
  diff: FileDiff[];
  manifest: ComponentManifest | null;
  publish: PublishPreview | null;
};

export type FinalizeResult = { publish: PublishResult; version: RegistryVersion; instanceId: string | null };

export type AiStatus = {
  available: boolean;
  reason: "missing" | "logged_out" | null;
  version: string | null;
  loggedIn: boolean | null;
  profiles: { assistant: boolean; generateur: boolean };
};

export type Environment = {
  daemon: { address: string; home: string };
  ai: AiStatus;
  git: string | null;
  gh: string | null;
  capacity: { cores: number; ramGb: number; hostSlots: number };
  github: { connected: boolean };
};

export const AiEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("starter.ready"), runId: z.string().min(1), plan: StarterPlan.nullable() }),
  z.object({ type: z.literal("draft.changed"), draftId: DraftId, status: DraftStatus }),
]);
export type AiEvent = z.infer<typeof AiEvent>;
