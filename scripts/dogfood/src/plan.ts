import {
  DOMAIN_COLORS,
  type Domain,
  type DomainInput,
  domainsOf,
  type Guideline,
  type GuidelineOwner,
  type Instance,
  type Layout,
  type Page,
} from "@kibo/schema";
import {
  type DesiredGuideline,
  type DesiredPage,
  type DesiredTicket,
  type ResolvedIds,
  resolveOwner,
} from "./desired";

export type GuidelineAdd = { owner: GuidelineOwner; path: string; content: string };
export type GuidelinePlan = { add: GuidelineAdd[]; drift: string[]; unresolved: string[] };
export type InstanceAdd = {
  pageId: string;
  component: string;
  config: Record<string, unknown>;
  layout?: Layout;
};
export type InstancePlan = { add: InstanceAdd[]; unresolved: string[] };
export type TicketCreate = DesiredTicket & { domainId: string | null };
export type TicketPlan = {
  create: TicketCreate[];
  setDomain: { ticketId: string; domainId: string }[];
  unresolved: string[];
};
export type ExistingTicket = { id: string; title: string; domainId: string | null };

export function knownDomains(all: Domain[], projectId: string): { list: Domain[]; ids: ResolvedIds } {
  const own = all.filter((d) => d.owner.scope === "project" && d.owner.projectId === projectId);
  const workspace = all.filter((d) => d.owner.scope === "workspace");
  const list = domainsOf({ project: { domains: own, shared: false }, workspace });
  const domains = new Map([...list].reverse().map((d) => [d.name, d.id]));
  return { list, ids: { projectId, domains, workspaceDomains: new Set(workspace.map((d) => d.id)) } };
}

export function missingDomains(existing: Domain[], desired: { name: string }[]): DomainInput[] {
  const known = new Set(existing.map((d) => d.name));
  return desired
    .filter((d) => !known.has(d.name))
    .map((d, i) => ({
      name: d.name,
      color: DOMAIN_COLORS[(existing.length + i) % DOMAIN_COLORS.length] ?? DOMAIN_COLORS[0],
    }));
}

const sameOwner = (a: GuidelineOwner, b: GuidelineOwner): boolean => {
  switch (a.scope) {
    case "workspace":
      return b.scope === "workspace";
    case "project":
      return b.scope === "project" && b.projectId === a.projectId;
    case "domain":
      return b.scope === "domain" && b.domainId === a.domainId && b.projectId === a.projectId;
  }
};

const ownerLabel = (g: DesiredGuideline) =>
  g.owner.scope === "domain" ? `${g.owner.scope} ${g.owner.name}` : g.owner.scope;

export function planGuidelines(
  existing: Guideline[],
  desired: DesiredGuideline[],
  ids: ResolvedIds,
): GuidelinePlan {
  const plan: GuidelinePlan = { add: [], drift: [], unresolved: [] };
  for (const g of desired) {
    const owner = resolveOwner(g.owner, ids);
    if (owner === null) {
      plan.unresolved.push(`${ownerLabel(g)}: ${g.path}`);
      continue;
    }
    const current = existing.find((e) => e.path === g.path && sameOwner(owner, e.owner));
    if (!current) plan.add.push({ owner, path: g.path, content: g.content });
    else if (current.content !== g.content) plan.drift.push(`${ownerLabel(g)}: ${g.path}`);
  }
  return plan;
}

const topLevel = (pages: Page[], title: string) =>
  pages.find((p) => p.parentId === null && p.title === title);

export function missingPages(pages: Page[], desired: DesiredPage[]): DesiredPage[] {
  return desired.filter((d) => !topLevel(pages, d.title));
}

export function missingInstances(
  current: { pages: Page[]; instances: Instance[] },
  desired: DesiredPage[],
  refs: ReadonlyMap<string, string>,
): InstancePlan {
  const plan: InstancePlan = { add: [], unresolved: [] };
  for (const d of desired) {
    const target = topLevel(current.pages, d.title);
    if (!target) continue;
    const placed = current.instances.filter((i) => i.pageId === target.id);
    for (const wanted of d.instances) {
      if (placed.some((i) => i.component.startsWith(`${wanted.componentId}@`))) continue;
      const component = refs.get(wanted.componentId);
      if (!component) {
        plan.unresolved.push(`${d.title}: ${wanted.componentId}`);
        continue;
      }
      plan.add.push({
        pageId: target.id,
        component,
        config: wanted.config,
        ...(wanted.layout ? { layout: wanted.layout } : {}),
      });
    }
  }
  return plan;
}

export function planTickets(
  existing: ExistingTicket[],
  desired: DesiredTicket[],
  domains: ReadonlyMap<string, string>,
): TicketPlan {
  const plan: TicketPlan = { create: [], setDomain: [], unresolved: [] };
  for (const d of desired) {
    const domainId = d.domain === null ? null : (domains.get(d.domain) ?? null);
    if (d.domain !== null && domainId === null) plan.unresolved.push(`${d.title}: domain ${d.domain}`);
    const current = existing.find((t) => t.title.trim() === d.title);
    if (!current) plan.create.push({ ...d, domainId });
    else if (current.domainId === null && domainId !== null)
      plan.setDomain.push({ ticketId: current.id, domainId });
  }
  return plan;
}

export function componentRefs(manifestVersions: ReadonlyMap<string, string>): Map<string, string> {
  return new Map([...manifestVersions].map(([id, version]) => [id, `${id}@${version}`]));
}
