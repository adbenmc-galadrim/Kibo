import type { Domain } from "@kibo/schema";

export function projectDomainsOf(
  project: { domains?: Domain[] } | null | undefined,
  config: { domains: Domain[] } | null | undefined,
): Domain[] | undefined {
  return project?.domains ?? config?.domains;
}
