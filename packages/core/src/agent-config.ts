import {
  type ConfigCommand,
  Domain,
  Guideline,
  type GuidelineOwner,
  KiboError,
  WorkspaceName,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { assertDeletableProfile, createProfile, getProfile, updateProfile } from "./agent-profiles";
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

export {
  assertDeletableProfile,
  ensureSystemProfiles,
  getProfile,
  listProfiles,
  systemModel,
} from "./agent-profiles";

export function workspaceName(ws: LoroDoc): string | null {
  const name = settingsMap(ws).get("name");
  return typeof name === "string" ? name : null;
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

export function listGuidelines(doc: LoroDoc): Guideline[] {
  return entries(guidelinesMap(doc))
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
    case "profile":
      return `profile:${o.profileId}`;
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
  if (owner.scope === "profile") getProfile(doc, owner.profileId);
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
    case "createProfile":
      return createProfile(doc, cmd.profile);
    case "updateProfile":
      return updateProfile(doc, cmd.profileId, cmd.patch);
    case "deleteProfile": {
      requireWorkspace(doc);
      assertDeletableProfile(doc, cmd.profileId);
      profilesMap(doc).delete(cmd.profileId);
      dropGuidelines(doc, { scope: "profile", profileId: cmd.profileId });
      doc.commit();
      return null;
    }
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
    case "renameWorkspace": {
      requireWorkspace(doc);
      const name = valid(WorkspaceName.safeParse(cmd.name));
      settingsMap(doc).set("name", name);
      doc.commit();
      return { name };
    }
  }
}
