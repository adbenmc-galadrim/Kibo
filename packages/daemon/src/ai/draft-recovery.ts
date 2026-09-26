import type { ComponentDraft, DraftIncident } from "@kibo/schema";
import { type DraftPaths, readDraftManifest, removeDraft } from "./draft-files";
import { present } from "./draft-fs";
import type { DraftEvent } from "./draft-machine";
import {
  hasInstallBackup,
  installDraft,
  installedIdentity,
  releaseSource,
  type SourceFate,
  type SourceIdentity,
} from "./draft-source";
import type { DraftStore } from "./draft-store";
import type { AiEvents, Clock, ComponentCatalog } from "./ports";

export type RecoveryDeps = {
  store: DraftStore;
  catalog: ComponentCatalog;
  clock: Clock;
  events: AiEvents;
  apply: (d: ComponentDraft, e: DraftEvent) => ComponentDraft;
  paths: (d: ComponentDraft) => DraftPaths;
  cancelLiveRun: (d: ComponentDraft) => void;
  restore: (d: ComponentDraft) => DraftIncident[];
  revalidate: (draftId: string) => void;
};

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export type DraftRecovery = {
  recoverAll(): void;
  abandon(d: ComponentDraft): void;
  noteFailure(d: ComponentDraft, detail: string): boolean;
};

export function createDraftRecovery(deps: RecoveryDeps): DraftRecovery {
  const noteFailure = (d: ComponentDraft, detail: string) => {
    if (!d.failure) return false;
    const next = { ...d, failure: { ...d.failure, detail }, updatedAt: deps.clock.now() };
    deps.store.save(next);
    deps.events.publish({ type: "draft.changed", draftId: next.id, status: next.status });
    return true;
  };

  const failVisibly = (id: string, e: unknown) => {
    const detail = errorText(e);
    let d = deps.store.get(id);
    if (d.status === "validating") {
      deps.apply(d, { type: "validation_crashed", detail });
      return;
    }
    if (d.status === "describing" || d.status === "generating") d = deps.apply(d, { type: "interrupted" });
    if (d.status === "failed" && noteFailure(d, detail)) return;
    console.error(`[kibo-daemon] draft ${id} could not be recovered`, e);
  };

  const isPublished = (d: ComponentDraft, draft: SourceIdentity | null) =>
    draft !== null &&
    draft.version !== d.baseVersion &&
    deps.catalog.latest(d.componentId)?.version === draft.version;

  const draftIdentity = (d: ComponentDraft): SourceIdentity => {
    const m = readDraftManifest(deps.paths(d).dir);
    return { id: m.id, version: m.version };
  };

  const finishInstall = (d: ComponentDraft) => {
    const srcDir = deps.catalog.sourceDir(d.componentId);
    if (!hasInstallBackup(srcDir)) return;
    const published = isPublished(d, draftIdentity(d));
    const install = installDraft(deps.paths(d).dir, srcDir);
    if (published) install.commit();
    else install.rollback();
  };

  const identityForRelease = (d: ComponentDraft, srcDir: string): SourceIdentity | null => {
    try {
      return draftIdentity(d);
    } catch (e) {
      console.error(`[kibo-daemon] draft ${d.id} manifest is unreadable`, e);
      const installed = hasInstallBackup(srcDir) ? installedIdentity(srcDir) : null;
      return installed?.id === d.componentId ? installed : null;
    }
  };

  const fateOf = (d: ComponentDraft, draft: SourceIdentity | null): SourceFate => {
    if (isPublished(d, draft)) return "published";
    return d.mode === "create" ? "reserved" : "unpublished";
  };

  const releaseDraftSource = (d: ComponentDraft) => {
    const srcDir = deps.catalog.sourceDir(d.componentId);
    const draft = identityForRelease(d, srcDir);
    if (!releaseSource(srcDir, fateOf(d, draft), draft))
      console.error(`[kibo-daemon] ${srcDir} is not the source of draft ${d.id}; left in place`);
  };

  const abandon = (d: ComponentDraft) => {
    if (d.status === "permissions") releaseDraftSource(d);
    const abandoned = deps.apply(d, { type: "abandoned" });
    deps.cancelLiveRun(abandoned);
    removeDraft(deps.paths(abandoned));
  };

  const recoverOne = (d: ComponentDraft) => {
    if (d.status === "permissions") finishInstall(d);
    const p = deps.paths(d);
    if (!present(p.baseDir)) abandon(deps.store.get(d.id));
    else if (d.status === "describing" || d.status === "generating") {
      const incidents = deps.restore(d);
      const failed = deps.apply(d, { type: "interrupted" });
      deps.cancelLiveRun(d);
      deps.apply(failed, { type: "restored", incidents });
    } else if (d.status === "validating") {
      const found = deps.restore(d);
      if (found.length > 0) deps.apply(d, { type: "restored", incidents: [...d.incidents, ...found] });
      deps.revalidate(d.id);
    }
  };

  return {
    abandon,
    noteFailure,
    recoverAll() {
      for (const d of deps.store.active()) {
        try {
          recoverOne(d);
        } catch (e) {
          failVisibly(d.id, e);
        }
      }
    },
  };
}
