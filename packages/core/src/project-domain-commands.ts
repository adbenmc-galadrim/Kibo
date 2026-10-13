import {
  type ConfigCommand,
  Domain,
  type DomainOwner,
  Guideline,
  type GuidelineOwner,
  KiboError,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { assertUniqueName, projectIdOf, valid } from "./config-store";
import {
  listProjectDomainGuidelines,
  listProjectDomains,
  projectDomainEntry,
  projectGuidelineId,
  removeProjectDomain,
  type StoredGuideline,
  upsertProjectDomain,
} from "./project-domains";

type DomainCommand = Extract<ConfigCommand, { method: "createDomain" | "updateDomain" | "deleteDomain" }>;
type GuidelineCommand = Extract<
  ConfigCommand,
  { method: "addGuideline" | "updateGuideline" | "removeGuideline" }
>;
type DomainGuidelineOwner = Extract<GuidelineOwner, { scope: "domain" }>;

const WRONG_DOC = "a project domain lives in its own project";

function assertProjectOwner(doc: LoroDoc, owner: DomainOwner | undefined): string {
  const projectId = projectIdOf(doc);
  if (owner?.scope !== "project" || projectId === undefined || owner.projectId !== projectId) {
    throw new KiboError("INVALID_INPUT", WRONG_DOC);
  }
  return projectId;
}

function assertDomainOwner(doc: LoroDoc, owner: DomainGuidelineOwner): void {
  if (owner.projectId === null || owner.projectId !== projectIdOf(doc)) {
    throw new KiboError("INVALID_INPUT", WRONG_DOC);
  }
}

export function executeProjectDomainCommand(doc: LoroDoc, cmd: DomainCommand): Domain | null {
  const projectId = assertProjectOwner(doc, cmd.owner);
  const owner = { scope: "project", projectId } as const;
  switch (cmd.method) {
    case "createDomain": {
      const domain = valid(Domain.safeParse({ ...cmd.domain, id: crypto.randomUUID(), owner }));
      assertUniqueName(listProjectDomains(doc), domain);
      upsertProjectDomain(doc, domain.id, domain, []);
      doc.commit();
      return domain;
    }
    case "updateDomain": {
      const current = projectDomainEntry(doc, cmd.domainId);
      const domain = valid(
        Domain.safeParse({ ...current.domain, ...cmd.patch, id: current.domain.id, owner }),
      );
      assertUniqueName(listProjectDomains(doc), domain);
      upsertProjectDomain(doc, domain.id, domain, current.guidelines);
      doc.commit();
      return domain;
    }
    case "deleteDomain": {
      projectDomainEntry(doc, cmd.domainId);
      removeProjectDomain(doc, cmd.domainId);
      doc.commit();
      return null;
    }
  }
}

function writeGuidelines(doc: LoroDoc, domainId: string, guidelines: StoredGuideline[]): void {
  const { domain } = projectDomainEntry(doc, domainId);
  upsertProjectDomain(doc, domainId, domain, guidelines);
  doc.commit();
}

function asGuideline(owner: DomainGuidelineOwner, path: string, content: string): Guideline {
  return valid(Guideline.safeParse({ id: projectGuidelineId(owner.domainId, path), owner, path, content }));
}

function assertFreePath(guidelines: StoredGuideline[], path: string, except: string | null): void {
  if (guidelines.some((g) => g.path === path && g.path !== except)) {
    throw new KiboError("INVALID_INPUT", `guideline ${path} already exists`);
  }
}

function findStored(doc: LoroDoc, owner: DomainGuidelineOwner, guidelineId: string): StoredGuideline {
  const found = listProjectDomainGuidelines(doc).find(
    (g) => g.id === guidelineId && g.owner.scope === "domain" && g.owner.domainId === owner.domainId,
  );
  if (!found) throw new KiboError("NOT_FOUND", `guideline ${guidelineId} not found`);
  return { path: found.path, content: found.content };
}

export function executeProjectDomainGuideline(
  doc: LoroDoc,
  cmd: GuidelineCommand & { owner: DomainGuidelineOwner },
): Guideline | null {
  const { owner } = cmd;
  assertDomainOwner(doc, owner);
  const { guidelines } = projectDomainEntry(doc, owner.domainId);
  switch (cmd.method) {
    case "addGuideline": {
      const g = asGuideline(owner, cmd.path, cmd.content);
      assertFreePath(guidelines, g.path, null);
      writeGuidelines(doc, owner.domainId, [...guidelines, { path: g.path, content: g.content }]);
      return g;
    }
    case "updateGuideline": {
      const current = findStored(doc, owner, cmd.guidelineId);
      const g = asGuideline(owner, cmd.path ?? current.path, cmd.content ?? current.content);
      assertFreePath(guidelines, g.path, current.path);
      const next = guidelines.map((e) =>
        e.path === current.path ? { path: g.path, content: g.content } : e,
      );
      writeGuidelines(doc, owner.domainId, next);
      return g;
    }
    case "removeGuideline": {
      const current = findStored(doc, owner, cmd.guidelineId);
      writeGuidelines(
        doc,
        owner.domainId,
        guidelines.filter((e) => e.path !== current.path),
      );
      return null;
    }
  }
}
