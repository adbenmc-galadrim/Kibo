import { listProjectDomainGuidelines, listProjectDomains, listTickets } from "@kibo/core";
import {
  executeConfigCommand,
  listDomains,
  listGuidelines,
  workspaceDescription,
  workspaceName,
} from "@kibo/core/agent-config";
import {
  type ConfigCommand,
  configTarget,
  iconOwnerKey,
  KiboError,
  type WorkspaceConfig,
} from "@kibo/schema";
import type { Docs } from "./docs";
import type { IconStore } from "./icons/icon-store";

function countDomains(docs: Docs, projectIds: string[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const id of projectIds) {
    for (const t of listTickets(docs.project(id))) {
      if (t.domainId) usage[t.domainId] = (usage[t.domainId] ?? 0) + 1;
    }
  }
  return usage;
}

export function domainUsage(docs: Docs): Record<string, number> {
  return countDomains(docs, docs.projectIds());
}

export function readConfig(docs: Docs, icons: Pick<IconStore, "version">): WorkspaceConfig {
  const projects = docs.projectIds().map((id) => docs.project(id));
  return {
    domains: [...listDomains(docs.workspace), ...projects.flatMap((doc) => listProjectDomains(doc))],
    guidelines: [
      ...listGuidelines(docs.workspace),
      ...projects.flatMap((doc) => [...listGuidelines(doc), ...listProjectDomainGuidelines(doc)]),
    ],
    domainUsage: domainUsage(docs),
    workspaceName: workspaceName(docs.workspace),
    workspaceDescription: workspaceDescription(docs.workspace),
    workspaceIcon: icons.version(iconOwnerKey({ kind: "workspace" })),
  };
}

function assertUnused(docs: Docs, domainId: string, projectId: string | null): void {
  const scope = projectId === null ? docs.projectIds() : [projectId];
  const used = countDomains(docs, scope)[domainId] ?? 0;
  if (used > 0) throw new KiboError("INVALID_INPUT", `domain ${domainId} is used by ${used} tickets`);
}

export function runConfigCommand(docs: Docs, cmd: ConfigCommand): unknown {
  const target = configTarget(cmd);
  if (target !== null) docs.assertWritable(target);
  if (cmd.method === "deleteDomain") assertUnused(docs, cmd.domainId, target);
  const result = executeConfigCommand(target ? docs.project(target) : docs.workspace, cmd);
  docs.save(target);
  docs.emit({ topic: "config" });
  return result;
}
