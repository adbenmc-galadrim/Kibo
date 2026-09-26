import { listTickets } from "@kibo/core";
import {
  assertDeletableProfile,
  configTarget,
  ensureSystemProfiles as ensureSystemProfilesIn,
  executeConfigCommand,
  listDomains,
  listGuidelines,
  listProfiles,
  workspaceName,
} from "@kibo/core/agent-config";
import { type ConfigCommand, KiboError, type WorkspaceConfig } from "@kibo/schema";
import type { Docs } from "./docs";

export function domainUsage(docs: Docs): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const id of docs.projectIds()) {
    for (const t of listTickets(docs.project(id))) {
      if (t.domainId) usage[t.domainId] = (usage[t.domainId] ?? 0) + 1;
    }
  }
  return usage;
}

export function readConfig(docs: Docs): WorkspaceConfig {
  return {
    profiles: listProfiles(docs.workspace),
    domains: listDomains(docs.workspace),
    guidelines: [
      ...listGuidelines(docs.workspace),
      ...docs.projectIds().flatMap((id) => listGuidelines(docs.project(id))),
    ],
    domainUsage: domainUsage(docs),
    workspaceName: workspaceName(docs.workspace),
  };
}

export function runConfigCommand(
  docs: Docs,
  cmd: ConfigCommand,
  activeRuns: (profileId: string) => number,
): unknown {
  if (cmd.method === "deleteProfile") {
    assertDeletableProfile(docs.workspace, cmd.profileId);
    if (activeRuns(cmd.profileId) > 0) {
      throw new KiboError("PROFILE_IN_USE", `profile ${cmd.profileId} has active runs`);
    }
  }
  if (cmd.method === "deleteDomain") {
    const used = domainUsage(docs)[cmd.domainId] ?? 0;
    if (used > 0) throw new KiboError("INVALID_INPUT", `domain ${cmd.domainId} is used by ${used} tickets`);
  }
  const target = configTarget(cmd);
  const result = executeConfigCommand(target ? docs.project(target) : docs.workspace, cmd);
  docs.save(target);
  docs.emit({ topic: "config" });
  return result;
}

export function ensureSystemProfiles(docs: Docs): void {
  if (!ensureSystemProfilesIn(docs.workspace)) return;
  docs.save(null);
  docs.emit({ topic: "config" });
}
