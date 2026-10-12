import {
  type ConfigCommand,
  Domain,
  Guideline,
  type GuidelineOwner,
  KiboError,
  WorkspacePatch,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import {
  assertUniqueName,
  byName,
  domainsMap,
  entries,
  guidelinesMap,
  profilesMap,
  projectIdOf,
  requireWorkspace,
  settingsMap,
  stored,
  valid,
} from "./config-store";

export function workspaceName(ws: LoroDoc): string | null {
  const name = settingsMap(ws).get("name");
  return typeof name === "string" ? name : null;
}

export function workspaceDescription(ws: LoroDoc): string | null {
  const description = settingsMap(ws).get("description");
  return typeof description === "string" ? description : null;
}

export function listDomains(ws: LoroDoc): Domain[] {
  return entries(domainsMap(ws))
    .map((v) => stored(Domain.safeParse(v), "domain"))
    .sort(byName);
}

function getDomain(ws: LoroDoc, id: string): Domain {
  const found = listDomains(ws).find((d) => d.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `domain ${id} not found`);
  return found;
}

const LEGACY_PROFILE_SCOPE = "profile";

function isLegacyProfileGuideline(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("owner" in value)) return false;
  const { owner } = value;
  return (
    typeof owner === "object" && owner !== null && "scope" in owner && owner.scope === LEGACY_PROFILE_SCOPE
  );
}

export function listGuidelines(doc: LoroDoc): Guideline[] {
  return entries(guidelinesMap(doc))
    .filter((v) => !isLegacyProfileGuideline(v))
    .map((v) => stored(Guideline.safeParse(v), "guideline"))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function ownerKey(o: GuidelineOwner): string {
  switch (o.scope) {
    case "workspace":
      return "workspace";
    case "project":
      return `project:${o.projectId}`;
    case "domain":
      return `domain:${o.domainId}`;
  }
}

function assertOwner(doc: LoroDoc, owner: GuidelineOwner): void {
  if (owner.scope === "project") {
    if (projectIdOf(doc) !== owner.projectId) {
      throw new KiboError("INVALID_INPUT", "project guidelines live in their own project");
    }
    return;
  }
  requireWorkspace(doc);
  if (owner.scope === "domain") getDomain(doc, owner.domainId);
}

function assertUniquePath(doc: LoroDoc, g: Guideline): void {
  const clash = listGuidelines(doc).some(
    (e) => e.id !== g.id && e.path === g.path && ownerKey(e.owner) === ownerKey(g.owner),
  );
  if (clash) throw new KiboError("INVALID_INPUT", `guideline ${g.path} already exists`);
}

function findGuideline(doc: LoroDoc, id: string, owner: GuidelineOwner): Guideline {
  const found = listGuidelines(doc).find((g) => g.id === id && ownerKey(g.owner) === ownerKey(owner));
  if (!found) throw new KiboError("NOT_FOUND", `guideline ${id} not found`);
  return found;
}

function dropGuidelines(doc: LoroDoc, owner: GuidelineOwner): void {
  for (const g of listGuidelines(doc)) {
    if (ownerKey(g.owner) === ownerKey(owner)) guidelinesMap(doc).delete(g.id);
  }
}

export function dropProfiles(doc: LoroDoc): { profiles: number; guidelines: number } {
  const profiles = profilesMap(doc);
  const ids = Object.keys(profiles.toJSON());
  const guidelines = guidelinesMap(doc);
  const legacy = Object.entries(guidelines.toJSON()).filter(([, v]) => isLegacyProfileGuideline(v));
  for (const id of ids) profiles.delete(id);
  for (const [id] of legacy) guidelines.delete(id);
  if (ids.length > 0 || legacy.length > 0) doc.commit();
  return { profiles: ids.length, guidelines: legacy.length };
}

export function configTarget(cmd: ConfigCommand): string | null {
  switch (cmd.method) {
    case "addGuideline":
    case "updateGuideline":
    case "removeGuideline":
      return cmd.owner.scope === "project" ? cmd.owner.projectId : null;
    default:
      return null;
  }
}

export function executeConfigCommand(doc: LoroDoc, cmd: ConfigCommand): unknown {
  switch (cmd.method) {
    case "createDomain": {
      requireWorkspace(doc);
      const domain = valid(Domain.safeParse({ ...cmd.domain, id: crypto.randomUUID() }));
      assertUniqueName(listDomains(doc), domain);
      domainsMap(doc).set(domain.id, domain);
      doc.commit();
      return domain;
    }
    case "updateDomain": {
      requireWorkspace(doc);
      const current = getDomain(doc, cmd.domainId);
      const domain = valid(Domain.safeParse({ ...current, ...cmd.patch, id: current.id }));
      assertUniqueName(listDomains(doc), domain);
      domainsMap(doc).set(domain.id, domain);
      doc.commit();
      return domain;
    }
    case "deleteDomain": {
      requireWorkspace(doc);
      getDomain(doc, cmd.domainId);
      domainsMap(doc).delete(cmd.domainId);
      dropGuidelines(doc, { scope: "domain", domainId: cmd.domainId });
      doc.commit();
      return null;
    }
    case "addGuideline": {
      assertOwner(doc, cmd.owner);
      const g = valid(
        Guideline.safeParse({
          id: crypto.randomUUID(),
          owner: cmd.owner,
          path: cmd.path,
          content: cmd.content,
        }),
      );
      assertUniquePath(doc, g);
      guidelinesMap(doc).set(g.id, g);
      doc.commit();
      return g;
    }
    case "updateGuideline": {
      assertOwner(doc, cmd.owner);
      const current = findGuideline(doc, cmd.guidelineId, cmd.owner);
      const g = valid(
        Guideline.safeParse({
          ...current,
          path: cmd.path ?? current.path,
          content: cmd.content ?? current.content,
        }),
      );
      assertUniquePath(doc, g);
      guidelinesMap(doc).set(g.id, g);
      doc.commit();
      return g;
    }
    case "removeGuideline": {
      assertOwner(doc, cmd.owner);
      findGuideline(doc, cmd.guidelineId, cmd.owner);
      guidelinesMap(doc).delete(cmd.guidelineId);
      doc.commit();
      return null;
    }
    case "updateWorkspace": {
      requireWorkspace(doc);
      const patch = valid(WorkspacePatch.safeParse(cmd.patch));
      const settings = settingsMap(doc);
      if (patch.name !== undefined) settings.set("name", patch.name);
      if (patch.description === null) settings.delete("description");
      else if (patch.description !== undefined) settings.set("description", patch.description);
      doc.commit();
      return { name: workspaceName(doc), description: workspaceDescription(doc) };
    }
  }
}
