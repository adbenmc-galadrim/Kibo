import { type Domain, domainsOf, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { listDomains, listGuidelines } from "./agent-config";
import { domainsMap, guidelinesMap, projectIdOf } from "./config-store";
import { hasProjectDomain, upsertProjectDomain } from "./project-domains";

export { domainsOf };

export type DomainUsageByProject = ReadonlyMap<string, ReadonlyMap<string, number>>;
export type KeepReason = "unused" | "shared";
export type ScopePlan = {
  move: { domainId: string; projectId: string }[];
  keep: { domainId: string; reason: KeepReason }[];
};

export function usersOf(usage: DomainUsageByProject, domainId: string): string[] {
  const byProject = usage.get(domainId);
  if (!byProject) return [];
  return [...byProject.entries()].filter(([, tickets]) => tickets > 0).map(([projectId]) => projectId);
}

export function planDomainScopes(domains: readonly Domain[], usage: DomainUsageByProject): ScopePlan {
  const plan: ScopePlan = { move: [], keep: [] };
  for (const domain of domains) {
    if (domain.owner.scope !== "workspace") continue;
    const users = usersOf(usage, domain.id);
    const [only] = users;
    if (only === undefined) plan.keep.push({ domainId: domain.id, reason: "unused" });
    else if (users.length > 1) plan.keep.push({ domainId: domain.id, reason: "shared" });
    else plan.move.push({ domainId: domain.id, projectId: only });
  }
  return plan;
}

export function applyDomainMove(
  workspace: LoroDoc,
  project: LoroDoc,
  projectId: string,
  domainId: string,
): void {
  if (projectIdOf(project) !== projectId) {
    throw new KiboError("INVALID_INPUT", `the doc is not the one of project ${projectId}`);
  }
  const domain = listDomains(workspace).find((d) => d.id === domainId);
  if (!domain) throw new KiboError("NOT_FOUND", `domain ${domainId} not found`);
  const guidelines = listGuidelines(workspace).filter(
    (g) => g.owner.scope === "domain" && g.owner.domainId === domainId,
  );
  if (!hasProjectDomain(project, domainId)) {
    upsertProjectDomain(
      project,
      domainId,
      domain,
      guidelines.map((g) => ({ path: g.path, content: g.content })),
    );
    project.commit();
  }
  domainsMap(workspace).delete(domainId);
  for (const g of guidelines) guidelinesMap(workspace).delete(g.id);
  workspace.commit();
}
