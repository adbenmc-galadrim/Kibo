import { getProjectMeta, hasProjectDomain, listTickets } from "@kibo/core";
import { listDomains } from "@kibo/core/agent-config";
import { settingsMap } from "@kibo/core/config-store";
import {
  applyDomainMove,
  type DomainUsageByProject,
  type KeepReason,
  planDomainScopes,
  usersOf,
} from "@kibo/core/domain-scope";
import { type Domain, KiboError } from "@kibo/schema";
import type { Docs } from "../docs";

const MARKER = "domainsScopedAt";

export type DomainScopeDeps = { docs: Docs; log: (line: string) => void; now: () => number };

function usageByProject(docs: Docs): DomainUsageByProject {
  const usage = new Map<string, Map<string, number>>();
  for (const projectId of docs.projectIds()) {
    for (const t of listTickets(docs.project(projectId))) {
      if (!t.domainId) continue;
      const byProject = usage.get(t.domainId) ?? new Map<string, number>();
      byProject.set(projectId, (byProject.get(projectId) ?? 0) + 1);
      usage.set(t.domainId, byProject);
    }
  }
  return usage;
}

function writable(docs: Docs, projectId: string): boolean {
  try {
    docs.assertWritable(projectId);
    return true;
  } catch (e) {
    if (e instanceof KiboError) return false;
    throw e;
  }
}

const projectName = (docs: Docs, projectId: string) => getProjectMeta(docs.project(projectId)).name;

function keptLine(docs: Docs, domain: Domain, reason: KeepReason, usage: DomainUsageByProject): string {
  const head = `domain "${domain.name}" kept in the workspace`;
  const users = usersOf(usage, domain.id);
  switch (reason) {
    case "unused":
      return `${head}: unused`;
    case "shared":
      return `${head}: used by ${users.length} projects`;
    case "read-only":
      return `${head}: project "${projectName(docs, users[0] ?? "")}" is read-only`;
  }
}

function moveDomain(docs: Docs, domain: Domain, projectId: string): string {
  const project = docs.project(projectId);
  const name = projectName(docs, projectId);
  const copied = hasProjectDomain(project, domain.id);
  applyDomainMove(docs.workspace, project, projectId, domain.id);
  docs.save(projectId);
  return copied
    ? `domain "${domain.name}" removed from the workspace: project "${name}" already has it`
    : `domain "${domain.name}" moved to project "${name}"`;
}

export async function migrateDomainScopes(
  deps: DomainScopeDeps,
): Promise<{ moved: number; kept: number } | null> {
  const { docs, log } = deps;
  const settings = settingsMap(docs.workspace);
  if (settings.get(MARKER) !== undefined) return null;
  const domains = new Map(listDomains(docs.workspace).map((d) => [d.id, d]));
  const usage = usageByProject(docs);
  const plan = planDomainScopes([...domains.values()], usage, (id) => writable(docs, id));
  for (const { domainId, projectId } of plan.move) {
    const domain = domains.get(domainId);
    if (domain) log(moveDomain(docs, domain, projectId));
  }
  for (const { domainId, reason } of plan.keep) {
    const domain = domains.get(domainId);
    if (domain) log(keptLine(docs, domain, reason, usage));
  }
  settings.set(MARKER, new Date(deps.now()).toISOString());
  docs.workspace.commit();
  docs.save(null);
  if (plan.move.length > 0) docs.emit({ topic: "config" });
  return { moved: plan.move.length, kept: plan.keep.length };
}
