import type { Domain, Guideline, GuidelineOwner, ProjectSummary, WorkspaceConfig } from "@kibo/schema";

export type NodeRef =
  | { kind: "workspace" }
  | { kind: "project"; projectId: string }
  | { kind: "domain"; domainId: string; projectId: string | null };

export type DomainFolder = { domain: Domain; files: Guideline[] };
export type WorkspaceFolder = { files: Guideline[]; domains: DomainFolder[]; count: number };
export type ProjectFolder = WorkspaceFolder & { project: ProjectSummary; readOnly: boolean };
export type DomainsTree = { workspace: WorkspaceFolder; projects: ProjectFolder[] };

type Config = Pick<WorkspaceConfig, "domains" | "guidelines">;

export const WORKSPACE_NODE: NodeRef = { kind: "workspace" };

export const byName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function nodeKey(ref: NodeRef): string {
  if (ref.kind === "workspace") return "workspace";
  if (ref.kind === "project") return `project:${ref.projectId}`;
  return `domain:${ref.projectId ?? ""}:${ref.domainId}`;
}

export const domainOwnerProject = (d: Domain): string | null =>
  d.owner.scope === "project" ? d.owner.projectId : null;

export const domainRef = (d: Domain): NodeRef => ({
  kind: "domain",
  domainId: d.id,
  projectId: domainOwnerProject(d),
});

export function ownerOf(ref: NodeRef): GuidelineOwner {
  if (ref.kind === "workspace") return { scope: "workspace" };
  if (ref.kind === "project") return { scope: "project", projectId: ref.projectId };
  return { scope: "domain", domainId: ref.domainId, projectId: ref.projectId };
}

function owns(g: Guideline, ref: NodeRef): boolean {
  const o = g.owner;
  if (ref.kind === "workspace") return o.scope === "workspace";
  if (ref.kind === "project") return o.scope === "project" && o.projectId === ref.projectId;
  return o.scope === "domain" && o.domainId === ref.domainId && o.projectId === ref.projectId;
}

export const filesOf = (config: Config, ref: NodeRef): Guideline[] =>
  config.guidelines.filter((g) => owns(g, ref));

export function findDomain(config: Config, ref: NodeRef): Domain | null {
  if (ref.kind !== "domain") return null;
  return config.domains.find((d) => d.id === ref.domainId && domainOwnerProject(d) === ref.projectId) ?? null;
}

export function chainOf(ref: NodeRef): NodeRef[] {
  if (ref.kind === "workspace") return [WORKSPACE_NODE];
  if (ref.kind === "project" || ref.projectId === null) return [WORKSPACE_NODE, ref];
  return [WORKSPACE_NODE, { kind: "project", projectId: ref.projectId }, ref];
}

function folder(config: Config, owner: string | null, own: NodeRef): WorkspaceFolder {
  const files = filesOf(config, own);
  const domains = byName(config.domains.filter((d) => domainOwnerProject(d) === owner)).map((domain) => ({
    domain,
    files: filesOf(config, domainRef(domain)),
  }));
  const domainFiles = owner === null ? 0 : domains.reduce((n, d) => n + d.files.length, 0);
  return { files, domains, count: files.length + domainFiles };
}

export function orderProjects<T extends { id: string; name: string }>(
  projects: readonly T[],
  currentId: string | null,
): T[] {
  const sorted = byName(projects);
  return [...sorted.filter((p) => p.id === currentId), ...sorted.filter((p) => p.id !== currentId)];
}

export function buildTree(
  config: Config,
  projects: readonly ProjectSummary[],
  currentProjectId: string | null,
  readOnly: ReadonlySet<string> = new Set(),
): DomainsTree {
  return {
    workspace: folder(config, null, WORKSPACE_NODE),
    projects: orderProjects(projects, currentProjectId).map((project) => ({
      ...folder(config, project.id, { kind: "project", projectId: project.id }),
      project,
      readOnly: readOnly.has(project.id),
    })),
  };
}
