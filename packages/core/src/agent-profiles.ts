import {
  type AgentModel,
  AgentProfile,
  KiboError,
  type ProfileInput,
  SYSTEM_PROFILE_IDS,
  type SystemProfileId,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import {
  assertUniqueName,
  byName,
  entries,
  profilesMap,
  requireWorkspace,
  stored,
  valid,
} from "./config-store";

const SYSTEM_FIELDS: Record<SystemProfileId, Pick<AgentProfile, "name" | "permissionMode">> = {
  assistant: { name: "assistant", permissionMode: "default" },
  generateur: { name: "generateur", permissionMode: "acceptEdits" },
};
const SYSTEM_EDITABLE = new Set(["model", "enabled", "maxParallel"]);
export const SYSTEM_MAX_PARALLEL = 4;
export const SYSTEM_DEFAULT_PARALLEL: Readonly<Record<SystemProfileId, number>> = {
  assistant: 1,
  generateur: 2,
};

const systemParallel = (id: SystemProfileId, current: AgentProfile | null): number => {
  const stored = current?.maxParallel;
  return stored !== undefined && stored <= SYSTEM_MAX_PARALLEL ? stored : SYSTEM_DEFAULT_PARALLEL[id];
};

const isSystemId = (id: string): id is SystemProfileId =>
  SYSTEM_PROFILE_IDS.some((systemId) => systemId === id);
const isReservedName = (name: string) => isSystemId(name.toLowerCase());

function readProfile(value: unknown): AgentProfile {
  const profile = stored(AgentProfile.safeParse(value), "profile");
  return { ...profile, system: isSystemId(profile.id) };
}

export function listProfiles(ws: LoroDoc): AgentProfile[] {
  return entries(profilesMap(ws)).map(readProfile).sort(byName);
}

export function getProfile(ws: LoroDoc, id: string): AgentProfile {
  const found = listProfiles(ws).find((p) => p.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `profile ${id} not found`);
  return found;
}

export function systemModel(profiles: AgentProfile[]): AgentModel {
  return profiles.filter((p) => !p.system).sort(byName)[0]?.model ?? "sonnet";
}

function systemProfile(
  id: SystemProfileId,
  current: AgentProfile | null,
  profiles: AgentProfile[],
): AgentProfile {
  return valid(
    AgentProfile.safeParse({
      ...SYSTEM_FIELDS[id],
      id,
      system: true,
      execution: "cli",
      workspace: "isolated",
      maxParallel: systemParallel(id, current),
      subagents: [],
      model: current?.model ?? systemModel(profiles),
      enabled: current?.enabled ?? true,
    }),
  );
}

const sameProfile = (a: unknown, b: AgentProfile) =>
  JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b).sort());

export function ensureSystemProfiles(ws: LoroDoc): boolean {
  requireWorkspace(ws);
  const profiles = listProfiles(ws);
  let changed = false;
  for (const id of SYSTEM_PROFILE_IDS) {
    const current = profiles.find((p) => p.id === id) ?? null;
    const next = systemProfile(id, current, profiles);
    if (sameProfile(profilesMap(ws).get(id), next)) continue;
    profilesMap(ws).set(id, next);
    changed = true;
  }
  if (changed) ws.commit();
  return changed;
}

function assertNoSystemFlag(input: object): void {
  if ("system" in input) throw new KiboError("INVALID_INPUT", "the system flag cannot be set");
}

function assertFreeName(name: string): void {
  if (isReservedName(name)) throw new KiboError("INVALID_INPUT", `name ${name} is reserved to Kibo`);
}

function assertEditable(current: AgentProfile, patch: Partial<ProfileInput>): void {
  if (!current.system) return;
  if (Object.keys(patch).some((key) => !SYSTEM_EDITABLE.has(key))) {
    throw new KiboError(
      "INVALID_INPUT",
      "only the model, the enabled flag and the parallelism of a system profile can change",
    );
  }
  if (patch.maxParallel !== undefined && patch.maxParallel > SYSTEM_MAX_PARALLEL)
    throw new KiboError(
      "INVALID_INPUT",
      `a system profile runs at most ${SYSTEM_MAX_PARALLEL} agents at once`,
    );
}

export function createProfile(ws: LoroDoc, input: ProfileInput): AgentProfile {
  requireWorkspace(ws);
  assertNoSystemFlag(input);
  assertFreeName(input.name);
  const profile = valid(AgentProfile.safeParse({ ...input, id: crypto.randomUUID(), system: false }));
  assertUniqueName(listProfiles(ws), profile);
  profilesMap(ws).set(profile.id, profile);
  ws.commit();
  return profile;
}

export function updateProfile(ws: LoroDoc, id: string, patch: Partial<ProfileInput>): AgentProfile {
  requireWorkspace(ws);
  assertNoSystemFlag(patch);
  const current = getProfile(ws, id);
  assertEditable(current, patch);
  const profile = valid(
    AgentProfile.safeParse({ ...current, ...patch, id: current.id, system: current.system }),
  );
  if (profile.name !== current.name) {
    assertFreeName(profile.name);
    assertUniqueName(listProfiles(ws), profile);
  }
  profilesMap(ws).set(profile.id, profile);
  ws.commit();
  return profile;
}

export function assertDeletableProfile(ws: LoroDoc, id: string): void {
  if (getProfile(ws, id).system) throw new KiboError("INVALID_INPUT", "a system profile cannot be deleted");
}
