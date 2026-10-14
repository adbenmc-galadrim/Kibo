import { z } from "zod";
import { AddDirs } from "./add-dir";
import { AllowRules } from "./allow-rule";
import { SkillId } from "./skill-id";

export const PermissionMode = z.enum(["default", "acceptEdits", "plan", "auto"]);
export type PermissionMode = z.infer<typeof PermissionMode>;

export const WorkspaceStrategy = z.enum(["worktree", "repo", "isolated"]);
export type WorkspaceStrategy = z.infer<typeof WorkspaceStrategy>;

export const AgentModel = z.enum(["opus", "sonnet", "haiku"]);
export type AgentModel = z.infer<typeof AgentModel>;
export const ModelName = z.string().regex(/^[a-z0-9][a-z0-9.-]{0,63}$/);

export const AGENT_SCOPES = ["global", "project", "system"] as const;
export const AgentScope = z.enum(AGENT_SCOPES);
export type AgentScope = z.infer<typeof AgentScope>;

export const AgentName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export type AgentName = z.infer<typeof AgentName>;

export const SYSTEM_AGENT_IDS = ["assistant", "generateur", "demo", "project-agent"] as const;
export type SystemAgentId = (typeof SYSTEM_AGENT_IDS)[number];

const NAME = "[a-z0-9][a-z0-9-]{0,63}";
export const AgentRef = z
  .string()
  .regex(
    new RegExp(`^(global:${NAME}|project:[0-9a-f-]{36}:${NAME}|system:(${SYSTEM_AGENT_IDS.join("|")}))$`),
  );
export type AgentRef = z.infer<typeof AgentRef>;

export type ParsedAgentRef =
  | { scope: "global"; name: string }
  | { scope: "project"; projectId: string; name: string }
  | { scope: "system"; id: SystemAgentId };

const isSystemAgentId = (id: string): id is SystemAgentId => SYSTEM_AGENT_IDS.some((s) => s === id);

export function parseAgentRef(ref: AgentRef): ParsedAgentRef {
  const [scope = "", ...rest] = ref.split(":");
  if (scope === "project") {
    const [projectId = "", name = ""] = rest;
    return { scope: "project", projectId, name };
  }
  const tail = rest.join(":");
  if (scope === "system" && isSystemAgentId(tail)) return { scope: "system", id: tail };
  return { scope: "global", name: tail };
}

export function agentRef(scope: AgentScope, projectId: string | null, name: string): AgentRef {
  if (scope === "project") return `project:${projectId ?? ""}:${name}`;
  return `${scope}:${name}`;
}

export const systemAgentRef = (id: SystemAgentId): AgentRef => `system:${id}`;
export const systemAgentName = (id: SystemAgentId): string => `kibo-${id}`;
export const SYSTEM_AGENT_NAMES: readonly string[] = SYSTEM_AGENT_IDS.map(systemAgentName);
export const isReservedAgentName = (name: string): boolean => SYSTEM_AGENT_NAMES.includes(name);
export const systemIdOfName = (name: string): SystemAgentId | null =>
  SYSTEM_AGENT_IDS.find((id) => systemAgentName(id) === name) ?? null;

export const PROJECT_AGENT_REF: AgentRef = systemAgentRef("project-agent");
export const DEMO_AGENT_REF: AgentRef = systemAgentRef("demo");
export const LEGACY_DEMO_ASSIGNEE = "demo";
export const assigneeName = (assignee: { kind: "human" | "agent"; ref: string }): string =>
  assignee.kind === "agent" && assignee.ref === LEGACY_DEMO_ASSIGNEE ? systemAgentName("demo") : assignee.ref;

export const AGENT_BODY_MAX = 100_000;
export const AGENT_DESCRIPTION_MAX = 1_024;
export const SUBAGENTS_MAX = 20;
export const ALLOWED_SKILLS_MAX = 50;
export const SYSTEM_MAX_PARALLEL = 4;

export const AgentFrontmatter = z.object({
  name: AgentName,
  description: z.string().min(1).max(AGENT_DESCRIPTION_MAX),
  model: ModelName.optional(),
  tools: z.array(z.string().min(1)).optional(),
  disallowedTools: z.array(z.string().min(1)).optional(),
  skills: z.array(z.string().min(1)).max(32).optional(),
  extra: z.string().default(""),
  extraKeys: z.array(z.string()).default([]),
});
export type AgentFrontmatter = z.infer<typeof AgentFrontmatter>;

export const AgentFile = z.object({ frontmatter: AgentFrontmatter, body: z.string().max(AGENT_BODY_MAX) });
export type AgentFile = z.infer<typeof AgentFile>;

export const SkillsRule = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("list"), ids: z.array(SkillId).max(ALLOWED_SKILLS_MAX) }),
]);
export type SkillsRule = z.infer<typeof SkillsRule>;

const SETTINGS_SHAPE = {
  workspace: WorkspaceStrategy,
  permissionMode: PermissionMode,
  allow: AllowRules,
  maxParallel: z.number().int().min(1).max(16),
  enabled: z.boolean(),
  subagents: z.array(AgentRef).max(SUBAGENTS_MAX),
  genericSubagents: z.boolean(),
  allSubagents: z.boolean(),
  skills: SkillsRule,
  addDirs: AddDirs,
};

export const AgentSettings = z.object({
  workspace: SETTINGS_SHAPE.workspace.default("worktree"),
  permissionMode: SETTINGS_SHAPE.permissionMode.default("default"),
  allow: SETTINGS_SHAPE.allow.default([]),
  maxParallel: SETTINGS_SHAPE.maxParallel.default(1),
  enabled: SETTINGS_SHAPE.enabled.default(true),
  subagents: SETTINGS_SHAPE.subagents.default([]),
  genericSubagents: SETTINGS_SHAPE.genericSubagents.default(true),
  allSubagents: SETTINGS_SHAPE.allSubagents.default(false),
  skills: SETTINGS_SHAPE.skills.default({ mode: "all" }),
  addDirs: SETTINGS_SHAPE.addDirs.default([]),
});
export type AgentSettings = z.infer<typeof AgentSettings>;
export const AgentSettingsPatch = z.object(SETTINGS_SHAPE).partial().strict();
export type AgentSettingsPatch = z.infer<typeof AgentSettingsPatch>;
export const DEFAULT_AGENT_SETTINGS: AgentSettings = AgentSettings.parse({});

const SYSTEM_PERMISSION: Record<SystemAgentId, PermissionMode> = {
  assistant: "default",
  generateur: "acceptEdits",
  demo: "acceptEdits",
  "project-agent": "default",
};
const SYSTEM_DEFAULT_PARALLEL: Record<SystemAgentId, number> = {
  assistant: 1,
  generateur: 2,
  demo: 1,
  "project-agent": 1,
};

function systemParallel(id: SystemAgentId, stored: number | undefined): number {
  if (id === "demo" || stored === undefined) return SYSTEM_DEFAULT_PARALLEL[id];
  return Math.min(Math.max(1, stored), SYSTEM_MAX_PARALLEL);
}

export function systemAgentSettings(id: SystemAgentId, stored: Partial<AgentSettings>): AgentSettings {
  return {
    ...DEFAULT_AGENT_SETTINGS,
    workspace: "isolated",
    permissionMode: SYSTEM_PERMISSION[id],
    maxParallel: systemParallel(id, stored.maxParallel),
    enabled: stored.enabled ?? true,
    subagents: [],
    genericSubagents: false,
    allSubagents: false,
    skills: id === "project-agent" ? { mode: "all" } : { mode: "list", ids: [] },
  };
}

export type Agent = {
  ref: AgentRef;
  scope: AgentScope;
  projectId: string | null;
  name: string;
  path: string;
  hash: string | null;
  file: AgentFile | null;
  problem: string | null;
  nameWarning: string | null;
  settings: AgentSettings;
  shadowedBy: AgentRef | null;
  activeRuns: number;
  modifiedAt: number | null;
};

export type AgentSummary = Omit<Agent, "file"> & {
  description: string;
  model: string | null;
  skillsCount: number | null;
  subagentsCount: number;
};

export const AGENT_TEMPLATES = ["blank", "delivery", "review", "seo", "conductor"] as const;
export const AgentTemplate = z.enum(AGENT_TEMPLATES);
export type AgentTemplate = z.infer<typeof AgentTemplate>;

export const AgentCreateInput = z.object({
  scope: z.enum(["global", "project"]),
  projectId: z.string().optional(),
  name: AgentName,
  description: z.string().min(1).max(AGENT_DESCRIPTION_MAX),
  model: ModelName.optional(),
  template: AgentTemplate.default("blank"),
});
export type AgentCreateInput = z.infer<typeof AgentCreateInput>;

export type SettingOrigin = "agent" | "project";

export type AgentPreview = {
  levels: { label: string; path: string; tokens: number }[];
  systemPrompt: string;
  brief: string;
  agentsJson: string;
  command: {
    model: string;
    permissionMode: PermissionMode;
    tools: string[] | null;
    disallowedTools: string[] | null;
    allow: string[];
    allowOrigins: { rule: string; origin: SettingOrigin }[];
    addDirs: { dir: string; origin: SettingOrigin }[];
    subagents: string[];
    allSubagents: boolean;
    skills: SkillsRule;
  };
};

export type MigrationNotice = { profileName: string; text: string };
