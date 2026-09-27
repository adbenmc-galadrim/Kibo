import { join } from "node:path";
import { KiboError, Page, type ProjectCommand, type ProjectMeta, Ticket } from "@kibo/schema";
import type { SeedClient } from "./daemon-client";
import type { ResolvedIds } from "./desired";
import type { Desired } from "./load";
import {
  componentRefs,
  missingDomains,
  missingInstances,
  missingPages,
  missingProfiles,
  planGuidelines,
  planTickets,
} from "./plan";

export const SEED_KINDS = [
  "project",
  "domain",
  "profile",
  "guideline",
  "page",
  "instance",
  "ticket",
  "ticketDomain",
  "notesDir",
] as const;
export type SeedKind = (typeof SEED_KINDS)[number];
export type SeedReport = {
  projectId: string;
  created: Record<SeedKind, number>;
  kept: Record<SeedKind, number>;
  warnings: string[];
};

const zero = (): Record<SeedKind, number> => ({
  project: 0,
  domain: 0,
  profile: 0,
  guideline: 0,
  page: 0,
  instance: 0,
  ticket: 0,
  ticketDomain: 0,
  notesDir: 0,
});

type Step = { client: SeedClient; desired: Desired; report: SeedReport };

async function ensureProject({ client, desired, report }: Step): Promise<ProjectMeta> {
  const projects = await client.rpc({ method: "listProjects" });
  const found = projects.find((p) => p.name === desired.project.name);
  if (found) {
    report.kept.project = 1;
    if (found.key !== desired.project.key) report.warnings.push(`project key is ${found.key}`);
    if (found.folder !== desired.project.folder) report.warnings.push(`project folder is ${found.folder}`);
    return found;
  }
  if (projects.some((p) => p.key === desired.project.key))
    throw new KiboError("CONFLICT", `key ${desired.project.key} is taken by another project`);
  report.created.project = 1;
  return client.rpc({ method: "createProject", ...desired.project });
}

async function ensureConfig({ client, desired, report }: Step, projectId: string): Promise<ResolvedIds> {
  const before = await client.rpc({ method: "getConfig" });
  const domains = missingDomains(before.domains, desired.domains);
  for (const domain of domains)
    await client.rpc({ method: "config", command: { method: "createDomain", domain } });
  const profiles = missingProfiles(
    before.profiles,
    desired.profiles.map((p) => p.profile),
  );
  for (const profile of profiles)
    await client.rpc({ method: "config", command: { method: "createProfile", profile } });
  report.created.domain = domains.length;
  report.kept.domain = desired.domains.length - domains.length;
  report.created.profile = profiles.length;
  report.kept.profile = desired.profiles.length - profiles.length;
  report.warnings.push(...desired.profiles.flatMap((p) => p.gaps));

  const config = await client.rpc({ method: "getConfig" });
  const ids: ResolvedIds = {
    projectId,
    domains: new Map(config.domains.map((d) => [d.name, d.id])),
    profiles: new Map(config.profiles.map((p) => [p.name, p.id])),
  };
  const plan = planGuidelines(config.guidelines, desired.guidelines, ids);
  for (const g of plan.add) await client.rpc({ method: "config", command: { method: "addGuideline", ...g } });
  report.created.guideline = plan.add.length;
  report.kept.guideline = desired.guidelines.length - plan.add.length - plan.unresolved.length;
  report.warnings.push(
    ...plan.drift.map((d) => `guideline edited in Kibo, left as is: ${d}`),
    ...plan.unresolved.map((u) => `guideline owner not found: ${u}`),
  );
  return ids;
}

async function ensurePages({ client, desired, report }: Step, projectId: string): Promise<void> {
  const command = (c: ProjectCommand) => client.rpc({ method: "command", projectId, command: c });
  const before = await client.rpc({ method: "getProject", projectId });
  const pages = missingPages(before.pages, desired.pages);
  for (const p of pages) Page.parse(await command({ method: "addPage", title: p.title, kind: p.kind }));
  report.created.page = pages.length;
  report.kept.page = desired.pages.length - pages.length;

  const after = await client.rpc({ method: "getProject", projectId });
  const components = await client.rpc({ method: "listComponents" });
  const plan = missingInstances(after, desired.pages, componentRefs(components, desired.manifestVersions));
  for (const i of plan.add) await command({ method: "addInstance", ...i });
  const wanted = desired.pages.reduce((n, p) => n + p.instances.length, 0);
  report.created.instance = plan.add.length;
  report.kept.instance = wanted - plan.add.length - plan.unresolved.length;
  report.warnings.push(...plan.unresolved.map((u) => `component without version: ${u}`));
}

async function ensureTickets({ client, desired, report }: Step, ids: ResolvedIds): Promise<void> {
  const projectId = ids.projectId;
  const command = (c: ProjectCommand) => client.rpc({ method: "command", projectId, command: c });
  const snapshot = await client.rpc({ method: "getProject", projectId });
  const plan = planTickets(snapshot.tickets, desired.tickets, ids.domains);
  for (const t of plan.create) {
    const ticket = Ticket.parse(
      await command({ method: "createTicket", title: t.title, description: t.description }),
    );
    if (t.domainId !== null)
      await command({ method: "updateTicket", ticketId: ticket.id, domainId: t.domainId });
  }
  for (const s of plan.setDomain) await command({ method: "updateTicket", ...s });
  report.created.ticket = plan.create.length;
  report.kept.ticket = desired.tickets.length - plan.create.length;
  report.created.ticketDomain = plan.setDomain.length;
  report.warnings.push(...plan.unresolved.map((u) => `ticket ${u} not found`));
}

async function ensureNotesDir({ client, desired, report }: Step, projectId: string): Promise<void> {
  const info = await client.rpc({ method: "getNotesDir", projectId });
  if (info.dir === desired.notesDir) {
    report.kept.notesDir = 1;
    return;
  }
  if (info.dir !== join(desired.project.folder, "notes")) {
    report.warnings.push(`notes folder chosen by hand, left as is: ${info.dir}`);
    return;
  }
  await client.rpc({ method: "setNotesDir", projectId, dir: desired.notesDir });
  report.created.notesDir = 1;
}

export async function seedKibo(client: SeedClient, desired: Desired): Promise<SeedReport> {
  const report: SeedReport = { projectId: "", created: zero(), kept: zero(), warnings: [] };
  const step: Step = { client, desired, report };
  const project = await ensureProject(step);
  report.projectId = project.id;
  const ids = await ensureConfig(step, project.id);
  await ensurePages(step, project.id);
  await ensureTickets(step, ids);
  await ensureNotesDir(step, project.id);
  return report;
}
