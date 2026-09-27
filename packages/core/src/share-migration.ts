import { Assignee, Domain, Guideline, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { listBindings } from "./bindings";
import { getKeyAllocator } from "./keys";
import { getProjectMeta } from "./project";
import { walkDepthFirst } from "./tree";

export type ShareMigrationInput = {
  localUser: string;
  userId: string;
  domains: { domain: Domain; guidelines: { path: string; content: string }[] }[];
};

function usedDomainIds(doc: LoroDoc): Set<string> {
  const ids = new Set<string>();
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    const domainId = node.data.get("domainId");
    if (typeof domainId === "string") ids.add(domainId);
  }
  return ids;
}

function migrateAssignees(doc: LoroDoc, input: ShareMigrationInput): void {
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    const assignee = Assignee.safeParse(node.data.get("assignee"));
    if (assignee.success && assignee.data.kind === "human" && assignee.data.ref === input.localUser) {
      node.data.set("assignee", { kind: "human", ref: input.userId });
    }
  }
}

function copyUsedDomains(doc: LoroDoc, input: ShareMigrationInput): void {
  const used = usedDomainIds(doc);
  const domains = doc.getMap("projectDomains");
  for (const { domain, guidelines } of input.domains) {
    if (used.has(domain.id)) domains.set(domain.id, { name: domain.name, color: domain.color, guidelines });
  }
}

function migrateBindings(doc: LoroDoc, input: ShareMigrationInput): void {
  const bindings = doc.getMap("bindings");
  const account = (user: string) => (user === input.localUser ? input.userId : user);
  for (const binding of listBindings(doc)) {
    const runner = account(binding.runner);
    const createdBy = account(binding.createdBy);
    if (runner !== binding.runner || createdBy !== binding.createdBy) {
      bindings.set(binding.id, { ...binding, runner, createdBy });
    }
  }
}

export function migrateForSharing(doc: LoroDoc, input: ShareMigrationInput): { folder: string | null } {
  const meta = getProjectMeta(doc);
  if (getKeyAllocator(doc) === "server") {
    throw new KiboError("INVALID_INPUT", `project ${meta.key} is already shared`);
  }
  const { folder } = meta;
  doc.getMap("meta").delete("folder");
  migrateAssignees(doc, input);
  copyUsedDomains(doc, input);
  migrateBindings(doc, input);
  doc.commit();
  return { folder };
}

function projectDomainEntries(doc: LoroDoc): [string, unknown][] {
  return Object.entries(doc.getMap("projectDomains").toJSON());
}

export function listProjectDomains(doc: LoroDoc): Domain[] {
  return projectDomainEntries(doc).flatMap(([id, value]) => {
    const parsed = Domain.safeParse(value instanceof Object ? { ...value, id } : null);
    return parsed.success ? [{ id, name: parsed.data.name, color: parsed.data.color }] : [];
  });
}

export function listProjectDomainGuidelines(doc: LoroDoc): Guideline[] {
  const known = new Set(listProjectDomains(doc).map((d) => d.id));
  return projectDomainEntries(doc).flatMap(([domainId, value]) => {
    if (!known.has(domainId) || !(value instanceof Object) || !("guidelines" in value)) return [];
    const list = Array.isArray(value.guidelines) ? value.guidelines : [];
    return list.flatMap((g: unknown) => {
      if (!(g instanceof Object) || !("path" in g)) return [];
      const id = `${domainId}:${String(g.path)}`;
      const parsed = Guideline.safeParse({ ...g, id, owner: { scope: "domain", domainId } });
      return parsed.success ? [parsed.data] : [];
    });
  });
}
