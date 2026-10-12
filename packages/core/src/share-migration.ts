import { Assignee, type Domain, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { listBindings } from "./bindings";
import { getKeyAllocator } from "./keys";
import { getProjectMeta } from "./project";
import { hasProjectDomain, upsertProjectDomain } from "./project-domains";
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

type Rename = { from: string; to: string };

function renameAssignees(doc: LoroDoc, { from, to }: Rename): void {
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    const assignee = Assignee.safeParse(node.data.get("assignee"));
    if (assignee.success && assignee.data.kind === "human" && assignee.data.ref === from) {
      node.data.set("assignee", { kind: "human", ref: to });
    }
  }
}

function copyUsedDomains(doc: LoroDoc, input: ShareMigrationInput): void {
  const used = usedDomainIds(doc);
  for (const { domain, guidelines } of input.domains) {
    if (used.has(domain.id) && !hasProjectDomain(doc, domain.id)) {
      upsertProjectDomain(doc, domain.id, domain, guidelines);
    }
  }
}

function renameBindings(doc: LoroDoc, { from, to }: Rename): void {
  const bindings = doc.getMap("bindings");
  const account = (user: string) => (user === from ? to : user);
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
  const rename = { from: input.localUser, to: input.userId };
  renameAssignees(doc, rename);
  copyUsedDomains(doc, input);
  renameBindings(doc, rename);
  doc.commit();
  return { folder };
}

export function migrateForUnsharing(doc: LoroDoc, input: { localUser: string; userId: string }): void {
  const rename = { from: input.userId, to: input.localUser };
  renameAssignees(doc, rename);
  renameBindings(doc, rename);
  doc.commit();
}
