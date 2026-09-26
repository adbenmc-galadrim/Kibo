import { basename, dirname, join } from "node:path";
import type { ComponentDraft, DraftIncident } from "@kibo/schema";
import { type DraftPaths, readDraftManifest, removeDraft } from "./draft-files";
import { present } from "./draft-fs";
import type { DraftEvent } from "./draft-machine";
import { installDraft, releaseSource, type SourceFate } from "./draft-source";
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

const installBackup = (srcDir: string) => join(dirname(srcDir), `.${basename(srcDir)}.kibo-backup`);

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

  const finishInstall = (d: ComponentDraft) => {
    const srcDir = deps.catalog.sourceDir(d.componentId);
    if (!present(installBackup(srcDir))) return;
    const dir = deps.paths(d).dir;
    const published = deps.catalog.latest(d.componentId)?.version === readDraftManifest(dir).version;
    const install = installDraft(dir, srcDir);
    if (published) install.commit();
    else install.rollback();
  };

  const sourceFate = (d: ComponentDraft): SourceFate => {
    if ((deps.catalog.latest(d.componentId)?.version ?? null) !== d.baseVersion) return "published";
    return d.mode === "create" ? "reserved" : "unpublished";
  };

  const abandon = (d: ComponentDraft) => {
    if (d.status === "permissions") releaseSource(deps.catalog.sourceDir(d.componentId), sourceFate(d));
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
