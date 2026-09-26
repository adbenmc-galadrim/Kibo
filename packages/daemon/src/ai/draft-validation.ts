import { type ComponentDraft, KiboError } from "@kibo/schema";
import { type DraftPaths, readDraftManifest, writePermissions } from "./draft-files";
import type { DraftEvent } from "./draft-machine";
import { declareMissing } from "./draft-permissions";
import { errorText } from "./draft-recovery";
import type { DraftStore } from "./draft-store";
import type { Devkit } from "./ports";

export type ValidationDeps = {
  store: DraftStore;
  devkit: Devkit;
  apply: (d: ComponentDraft, e: DraftEvent) => ComponentDraft;
  paths: (d: ComponentDraft) => DraftPaths;
};

const configChanged = (p: DraftPaths) => {
  const base = readDraftManifest(p.baseDir);
  const current = readDraftManifest(p.dir);
  return (
    base.configVersion !== current.configVersion ||
    JSON.stringify(base.configSchema ?? null) !== JSON.stringify(current.configSchema ?? null)
  );
};

export function createDraftValidation(deps: ValidationDeps): (id: string) => Promise<void> {
  const inferOrNull = async (dir: string) => {
    try {
      return await deps.devkit.infer(dir);
    } catch (e) {
      if (e instanceof KiboError && e.code === "VALIDATION_FAILED") return null;
      throw e;
    }
  };

  const stillValidating = (id: string) => {
    const d = deps.store.get(id);
    return d.status === "validating" ? d : null;
  };

  const checkPermissions = async (id: string, dir: string) => {
    const permissions = await inferOrNull(dir);
    if (!stillValidating(id)) return null;
    if (permissions) writePermissions(dir, permissions);
    const report = await deps.devkit.validate(dir);
    if (report.ok || !stillValidating(id) || !declareMissing(dir, report.permissions.missing)) return report;
    return deps.devkit.validate(dir);
  };

  return async (id) => {
    const d = stillValidating(id);
    if (!d) return;
    const p = deps.paths(d);
    try {
      if (d.mode === "modify" && configChanged(p)) {
        deps.apply(d, { type: "config_changed" });
        return;
      }
      const report = await checkPermissions(id, p.dir);
      const current = stillValidating(id);
      if (!report || !current) return;
      deps.store.saveReport(id, report);
      deps.apply(current, { type: "validated", ok: report.ok });
    } catch (e) {
      const current = stillValidating(id);
      if (current) deps.apply(current, { type: "validation_crashed", detail: errorText(e) });
    }
  };
}
