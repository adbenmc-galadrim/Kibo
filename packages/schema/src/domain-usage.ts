import type { Domain, DomainOwner } from "./workspace-config";

export type UsageProject = {
  id: string;
  shared: boolean;
  domainIds: readonly string[];
  ticketDomains: readonly (string | null)[];
};

export type DomainUsageCount = {
  workspace: Record<string, number>;
  projects: Record<string, Record<string, number>>;
};

export function usageOwner(
  project: Pick<UsageProject, "id" | "shared" | "domainIds">,
  domainId: string,
): DomainOwner | null {
  if (project.domainIds.includes(domainId)) return { scope: "project", projectId: project.id };
  return project.shared ? null : { scope: "workspace" };
}

const bump = (counts: Record<string, number>, id: string) => {
  counts[id] = (counts[id] ?? 0) + 1;
};

function projectCounts(usage: DomainUsageCount, projectId: string): Record<string, number> {
  const counts = usage.projects[projectId] ?? {};
  usage.projects[projectId] = counts;
  return counts;
}

export function countDomainUsage(projects: readonly UsageProject[]): DomainUsageCount {
  const usage: DomainUsageCount = { workspace: {}, projects: {} };
  for (const project of projects) {
    for (const domainId of project.ticketDomains) {
      if (domainId === null) continue;
      const owner = usageOwner(project, domainId);
      if (owner?.scope === "workspace") bump(usage.workspace, domainId);
      if (owner?.scope === "project") bump(projectCounts(usage, project.id), domainId);
    }
  }
  return usage;
}

export function domainUsageOf(
  config: {
    domainUsage: Record<string, number>;
    projectDomainUsage?: Record<string, Record<string, number>>;
  },
  domain: Domain,
): number {
  if (domain.owner.scope === "workspace") return config.domainUsage[domain.id] ?? 0;
  return config.projectDomainUsage?.[domain.owner.projectId]?.[domain.id] ?? 0;
}
