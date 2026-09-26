import { Assignee, type Domain } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { listBindings } from "./bindings";
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
  const { folder } = getProjectMeta(doc);
  doc.getMap("meta").delete("folder");
  migrateAssignees(doc, input);
  copyUsedDomains(doc, input);
  migrateBindings(doc, input);
  doc.commit();
  return { folder };
}
