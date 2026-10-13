import { type Domain, domainsOf } from "@kibo/schema";

type ProjectDomains = { domains?: Domain[]; sync?: { keyAllocator: string } };

export function projectDomainsOf(
  project: ProjectDomains | null | undefined,
  config: { domains: Domain[] } | null | undefined,
): Domain[] | undefined {
  if (!config) return undefined;
  const workspace = config.domains.filter((d) => d.owner.scope === "workspace");
  const shared = project?.sync?.keyAllocator === "server";
  return domainsOf({ project: { domains: project?.domains ?? [], shared }, workspace });
}
