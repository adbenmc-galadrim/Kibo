import type { Domain } from "./workspace-config";

export function domainsOf(input: {
  project: { domains: readonly Domain[]; shared: boolean };
  workspace: readonly Domain[];
}): Domain[] {
  const own = input.project.domains;
  if (input.project.shared) return [...own];
  return [...own, ...input.workspace.filter((w) => !own.some((d) => d.id === w.id))];
}
