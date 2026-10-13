import type { Domain } from "./workspace-config";

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function compareDomains(a: Domain, b: Domain): number {
  return a.name.localeCompare(b.name, "fr") || byId(a, b);
}

export function sortDomains(domains: readonly Domain[]): Domain[] {
  return [...domains].sort(compareDomains);
}

export function domainsOf(input: {
  project: { domains: readonly Domain[]; shared: boolean };
  workspace: readonly Domain[];
}): Domain[] {
  const own = sortDomains(input.project.domains);
  if (input.project.shared) return own;
  return [...own, ...sortDomains(input.workspace).filter((w) => !own.some((d) => d.id === w.id))];
}
