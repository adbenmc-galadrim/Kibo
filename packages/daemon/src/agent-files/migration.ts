import { dropProfiles } from "@kibo/core/agent-config";
import { renderAgentFile } from "@kibo/core/agents/frontmatter";
import { guidelinesMap, profilesMap } from "@kibo/core/config-store";
import {
  type AgentFile,
  AgentName,
  AgentRef,
  AllowRules,
  isReservedAgentName,
  type MigrationNotice,
  PermissionMode,
  SYSTEM_AGENT_IDS,
  type SystemAgentId,
  systemAgentRef,
  WorkspaceStrategy,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { z } from "zod";
import type { RunStore } from "../agents/run-store";
import { AGENT_FILE } from "./catalog";
import type { FileHistory } from "./file-history";
import { contentHash, readWithHash } from "./guarded-write";
import { migratedName } from "./migration-names";
import { existingAgentNotice, renamedNotice, unreadableNotice } from "./notices";
import { type AgentRoots, agentPath } from "./paths";
import type { AgentSettingsStore } from "./settings-store";
import { AGENT_FILE_MODE, defaultSystemBody, systemAgentFile } from "./system-agents";
import { versionedWrite } from "./versioned-write";

export const MIGRATION_MARKER = "agents_migrated_at";

export type MigrationInput = {
  workspace: LoroDoc;
  saveWorkspace(): void;
  runs: Pick<RunStore, "rewriteAgentRefs" | "marker" | "setMarker" | "records">;
  roots: AgentRoots;
  settings: AgentSettingsStore;
  history: FileHistory;
  projectKeys?: Readonly<Record<string, string>>;
  now: () => number;
};

const LegacyProfile = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  model: z.string().optional(),
  permissionMode: PermissionMode.optional(),
  workspace: WorkspaceStrategy.optional(),
  maxParallel: z.number().int().min(1).max(16).optional(),
  enabled: z.boolean().optional(),
  allow: AllowRules.optional(),
});
type LegacyProfile = z.infer<typeof LegacyProfile>;
const LegacyGuideline = z.object({
  owner: z.object({ scope: z.literal("profile"), profileId: z.string() }),
  path: z.string(),
  content: z.string(),
});
type LegacyGuideline = z.infer<typeof LegacyGuideline>;

const isSystemId = (id: string): id is SystemAgentId => SYSTEM_AGENT_IDS.some((s) => s === id);

function legacyProfiles(values: Record<string, unknown>): LegacyProfile[] {
  return Object.entries(values).flatMap(([key, value]) => {
    const parsed = LegacyProfile.safeParse(value);
    if (parsed.success) return [parsed.data];
    console.error(`[kibo-daemon] legacy profile ${key} not migrated: ${parsed.error.message}`);
    return [];
  });
}

const legacyGuidelines = (values: Record<string, unknown>): LegacyGuideline[] =>
  Object.values(values).flatMap((value) => {
    const parsed = LegacyGuideline.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });

export function guidelinesBody(guidelines: readonly LegacyGuideline[], profileId: string): string {
  return guidelines
    .filter((g) => g.owner.profileId === profileId)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((g) => `## ${g.path}\n\n${g.content.trim()}`)
    .join("\n\n");
}

const userFile = (profile: Pick<LegacyProfile, "name" | "model">, name: string, body: string): AgentFile => ({
  frontmatter: {
    name,
    description: `Agent migré du profil Kibo ${profile.name}`,
    ...(profile.model === undefined ? {} : { model: profile.model }),
    extra: "",
    extraKeys: [],
  },
  body,
});

type Placed = { ref: AgentRef; content: string; hadGuidelines: boolean };

async function place(input: MigrationInput, placed: Placed): Promise<"written" | "same" | "existing"> {
  const path = agentPath(input.roots, placed.ref);
  const current = await readWithHash(path);
  if (current?.content === placed.content) return "same";
  if (current === null) {
    const result = await versionedWrite({
      history: input.history,
      kind: "agents",
      ref: placed.ref,
      file: AGENT_FILE,
      path,
      content: placed.content,
      baseHash: null,
      mode: AGENT_FILE_MODE,
      origin: "migration",
      by: null,
    });
    if (result.kind === "written") return "written";
  }
  if (
    placed.hadGuidelines &&
    !input.history.hasHash("agents", placed.ref, AGENT_FILE, contentHash(placed.content))
  ) {
    input.history.deposit({
      kind: "agents",
      ref: placed.ref,
      file: AGENT_FILE,
      content: placed.content,
      origin: "migration",
      by: null,
      note: "guidelines du profil Kibo",
    });
  }
  return "existing";
}

async function migrateUser(input: MigrationInput, profile: LegacyProfile, body: string) {
  const name = migratedName(profile.name, profile.id);
  const ref = AgentRef.parse(`global:${name}`);
  const content = renderAgentFile(userFile(profile, name, body));
  const existed = (await place(input, { ref, content, hadGuidelines: body !== "" })) === "existing";
  input.settings.set(ref, {
    ...(profile.workspace === undefined ? {} : { workspace: profile.workspace }),
    ...(profile.permissionMode === undefined ? {} : { permissionMode: profile.permissionMode }),
    ...(profile.maxParallel === undefined ? {} : { maxParallel: profile.maxParallel }),
    ...(profile.enabled === undefined ? {} : { enabled: profile.enabled }),
    allow: profile.allow ?? [],
    subagents: [],
    genericSubagents: true,
  });
  if (name !== profile.name) return { ref, notice: renamedNotice(profile.name, name, existed) };
  return { ref, notice: existed ? existingAgentNotice(profile.name) : null };
}

function keepOrphans(
  input: MigrationInput,
  guidelines: readonly LegacyGuideline[],
  covered: ReadonlySet<string>,
  rawNames: Readonly<Record<string, string>>,
): MigrationNotice[] {
  const orphans = [...new Set(guidelines.map((g) => g.owner.profileId))].filter((id) => !covered.has(id));
  return orphans.map((profileId) => {
    const profileName = rawNames[profileId] ?? profileId;
    const name = migratedName(profileName, profileId);
    const ref = `global:${name}`;
    const content = renderAgentFile(
      userFile({ name: profileName }, name, guidelinesBody(guidelines, profileId)),
    );
    if (!input.history.hasHash("agents", ref, AGENT_FILE, contentHash(content))) {
      input.history.deposit({
        kind: "agents",
        ref,
        file: AGENT_FILE,
        content,
        origin: "migration",
        by: null,
        note: "guidelines d'un profil Kibo illisible",
      });
    }
    return unreadableNotice(profileName, name);
  });
}

function rawProfileNames(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const name = z.object({ name: z.string().min(1) }).safeParse(value);
      return [key, name.success ? name.data.name : key];
    }),
  );
}

async function migrateSystem(input: MigrationInput, id: SystemAgentId, profile: LegacyProfile, body: string) {
  const ref = systemAgentRef(id);
  const content = renderAgentFile(
    systemAgentFile(id, body === "" ? defaultSystemBody(id) : body, profile.model),
  );
  await place(input, { ref, content, hadGuidelines: body !== "" });
  input.settings.set(ref, {
    ...(profile.enabled === undefined ? {} : { enabled: profile.enabled }),
    ...(profile.maxParallel === undefined ? {} : { maxParallel: profile.maxParallel }),
  });
  return ref;
}

function runRefs(input: MigrationInput, mapped: Record<string, AgentRef>): Record<string, AgentRef> {
  const refs: Record<string, AgentRef> = { ...mapped };
  for (const id of SYSTEM_AGENT_IDS) refs[id] ??= systemAgentRef(id);
  for (const run of input.runs.records()) {
    if (refs[run.profileId] || AgentRef.safeParse(run.profileId).success) continue;
    const name = AgentName.safeParse(run.profileName);
    if (name.success && !isReservedAgentName(name.data)) refs[run.profileId] = `global:${name.data}`;
  }
  return refs;
}

export async function migrateProfiles(
  input: MigrationInput,
): Promise<{ migrated: boolean; notices: MigrationNotice[] }> {
  if (input.runs.marker(MIGRATION_MARKER) !== null) return { migrated: false, notices: [] };
  const rawProfiles = profilesMap(input.workspace).toJSON();
  const profiles = legacyProfiles(rawProfiles);
  const guidelines = legacyGuidelines(guidelinesMap(input.workspace).toJSON());
  const notices: MigrationNotice[] = [];
  const mapped: Record<string, AgentRef> = {};
  for (const profile of profiles) {
    const body = guidelinesBody(guidelines, profile.id);
    if (isSystemId(profile.id)) {
      mapped[profile.id] = await migrateSystem(input, profile.id, profile, body);
      continue;
    }
    const { ref, notice } = await migrateUser(input, profile, body);
    mapped[profile.id] = ref;
    if (notice) notices.push(notice);
  }
  notices.push(...keepOrphans(input, guidelines, new Set(Object.keys(mapped)), rawProfileNames(rawProfiles)));
  input.runs.rewriteAgentRefs(runRefs(input, mapped), input.projectKeys ?? {});
  const dropped = dropProfiles(input.workspace);
  if (dropped.profiles > 0 || dropped.guidelines > 0) input.saveWorkspace();
  input.runs.setMarker(MIGRATION_MARKER, new Date(input.now()).toISOString());
  return { migrated: true, notices };
}
