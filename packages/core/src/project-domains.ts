import { compareDomains, Domain, type DomainInput, Guideline, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { projectIdOf } from "./config-store";

export type StoredGuideline = { path: string; content: string };
type StoredDomain = { name: string; color: string; guidelines: StoredGuideline[] };

export const projectDomainsMap = (doc: LoroDoc) => doc.getMap("projectDomains");

function requireProjectId(doc: LoroDoc): string {
  const projectId = projectIdOf(doc);
  if (projectId === undefined) throw new KiboError("INVALID_INPUT", "project domains live in a project");
  return projectId;
}

function storedGuidelines(value: object): StoredGuideline[] {
  if (!("guidelines" in value) || !Array.isArray(value.guidelines)) return [];
  return value.guidelines.flatMap((g: unknown) =>
    g instanceof Object && "path" in g && "content" in g && typeof g.path === "string"
      ? [{ path: g.path, content: typeof g.content === "string" ? g.content : "" }]
      : [],
  );
}

function storedDomains(doc: LoroDoc): { domain: Domain; guidelines: StoredGuideline[] }[] {
  const entries = Object.entries(projectDomainsMap(doc).toJSON());
  if (entries.length === 0) return [];
  const owner = { scope: "project", projectId: requireProjectId(doc) } as const;
  return entries
    .flatMap(([id, value]) => {
      if (!(value instanceof Object)) return [];
      const parsed = Domain.safeParse({ ...value, id, owner });
      if (!parsed.success) return [];
      const { name, color } = parsed.data;
      return [{ domain: { id, name, color, owner }, guidelines: storedGuidelines(value) }];
    })
    .sort((a, b) => compareDomains(a.domain, b.domain));
}

export function listProjectDomains(doc: LoroDoc): Domain[] {
  return storedDomains(doc).map((d) => d.domain);
}

export const projectGuidelineId = (domainId: string, path: string) => `${domainId}:${path}`;

export function listProjectDomainGuidelines(doc: LoroDoc): Guideline[] {
  return storedDomains(doc).flatMap(({ domain, guidelines }) =>
    [...guidelines]
      .sort((a, b) => a.path.localeCompare(b.path))
      .flatMap((g) => {
        const owner = { scope: "domain", domainId: domain.id, projectId: requireProjectId(doc) };
        const id = projectGuidelineId(domain.id, g.path);
        const parsed = Guideline.safeParse({ ...g, id, owner });
        return parsed.success ? [parsed.data] : [];
      }),
  );
}

export function projectDomainEntry(
  doc: LoroDoc,
  domainId: string,
): { domain: Domain; guidelines: StoredGuideline[] } {
  const found = storedDomains(doc).find((d) => d.domain.id === domainId);
  if (!found) throw new KiboError("NOT_FOUND", `domain ${domainId} not found`);
  return found;
}

export function hasProjectDomain(doc: LoroDoc, domainId: string): boolean {
  return projectDomainsMap(doc).get(domainId) !== undefined;
}

export function upsertProjectDomain(
  doc: LoroDoc,
  domainId: string,
  domain: DomainInput,
  guidelines: StoredGuideline[],
): void {
  const stored: StoredDomain = { name: domain.name, color: domain.color, guidelines };
  projectDomainsMap(doc).set(domainId, stored);
}

export function removeProjectDomain(doc: LoroDoc, domainId: string): void {
  projectDomainsMap(doc).delete(domainId);
}
