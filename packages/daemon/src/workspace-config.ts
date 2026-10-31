import { listProjectDomainGuidelines, listProjectDomains } from "@kibo/core";
import {
  executeConfigCommand,
  listDomains,
  listGuidelines,
  workspaceDescription,
  workspaceName,
} from "@kibo/core/agent-config";
import { domainUsageOfProjects } from "@kibo/core/domain-usage";
import {
  type ConfigCommand,
  configTarget,
  type DomainUsageCount,
  iconOwnerKey,
  KiboError,
  type WorkspaceConfig,
} from "@kibo/schema";
import type { Docs } from "./docs";
import type { IconStore } from "./icons/icon-store";

const projectDocs = (docs: Docs) => [...docs.projectIds()].sort().map((id) => docs.project(id));

function domainUsage(docs: Docs): DomainUsageCount {
  return domainUsageOfProjects(projectDocs(docs));
}

export function readConfig(docs: Docs, icons: Pick<IconStore, "version">): WorkspaceConfig {
  const projects = projectDocs(docs);
  const usage = domainUsage(docs);
  return {
    domains: [...listDomains(docs.workspace), ...projects.flatMap((doc) => listProjectDomains(doc))],
    guidelines: [
      ...listGuidelines(docs.workspace),
      ...projects.flatMap((doc) => [...listGuidelines(doc), ...listProjectDomainGuidelines(doc)]),
    ],
    domainUsage: usage.workspace,
    projectDomainUsage: usage.projects,
    workspaceName: workspaceName(docs.workspace),
    workspaceDescription: workspaceDescription(docs.workspace),
    workspaceIcon: icons.version(iconOwnerKey({ kind: "workspace" })),
  };
}

function assertUnused(docs: Docs, domainId: string, projectId: string | null): void {
  const usage = domainUsage(docs);
  const counts = projectId === null ? usage.workspace : (usage.projects[projectId] ?? {});
  const used = counts[domainId] ?? 0;
  if (used > 0) throw new KiboError("INVALID_INPUT", `domain ${domainId} is used by ${used} tickets`);
}

export function runConfigCommand(docs: Docs, cmd: ConfigCommand): unknown {
  const target = configTarget(cmd);
  if (cmd.method === "deleteDomain") assertUnused(docs, cmd.domainId, target);
  const result = executeConfigCommand(target ? docs.project(target) : docs.workspace, cmd);
  docs.save(target);
  docs.emit({ topic: "config" });
  return result;
}
