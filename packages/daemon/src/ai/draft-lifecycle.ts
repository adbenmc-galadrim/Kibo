import {
  type ComponentDraft,
  type DraftIncident,
  KiboError,
  type StartComponentDraftInput,
} from "@kibo/schema";
import {
  copySource,
  type DraftPaths,
  draftPaths,
  prepareDraft,
  readDraftManifest,
  removeDraft,
  verifyAndRestore,
  writePermissions,
} from "./draft-files";
import { createDraftGuard } from "./draft-guard";
import { applyDraftEvent, canRetry, type DraftEvent, isActive } from "./draft-machine";
import { newDraft } from "./draft-new";
import { declareMissing } from "./draft-permissions";
import { createDraftRecovery, errorText } from "./draft-recovery";
import type { DraftStore } from "./draft-store";
import type {
  AgentRuns,
  AiAvailability,
  AiEvents,
  Clock,
  ComponentCatalog,
  Devkit,
  Editor,
  RunEnd,
} from "./ports";
import { draftKiboFiles, fixPrompt, type GeneratorBrief, generatorPrompt } from "./prompts";

export type LifecycleDeps = {
  store: DraftStore;
  runs: AgentRuns;
  devkit: Devkit;
  catalog: ComponentCatalog;
  ai: AiAvailability;
  events: AiEvents;
  clock: Clock;
  editor: Editor;
  home: string;
  sdkDir: string;
  args: () => string[];
  env: () => Record<string, string>;
  newId: () => string;
};

export type DraftLifecycle = {
  start(input: StartComponentDraftInput): Promise<ComponentDraft>;
  retry(draftId: string): ComponentDraft;
  revalidate(draftId: string): Promise<ComponentDraft>;
  abandon(draftId: string): null;
  openFolder(draftId: string): Promise<null>;
  list(): ComponentDraft[];
  recover(): Promise<void>;
  idle(): Promise<void>;
};

const LIVE_RUN = new Set(["queued", "starting", "running", "waiting_input"]);

export const applyAndPublish =
  (store: DraftStore, events: AiEvents, clock: Clock) =>
  (d: ComponentDraft, e: DraftEvent): ComponentDraft => {
    const next = applyDraftEvent(d, e, clock.now());
    if (next === d) return d;
    store.save(next);
    events.publish({ type: "draft.changed", draftId: next.id, status: next.status });
    return next;
  };

const brief = (d: ComponentDraft): GeneratorBrief => ({
  mode: d.mode,
  componentId: d.componentId,
  title: d.title,
  kind: d.kind,
  withServer: d.withServer,
  description: d.description,
  baseVersion: d.baseVersion,
});

const configChanged = (p: DraftPaths) => {
  const base = readDraftManifest(p.baseDir);
  const current = readDraftManifest(p.dir);
  return (
    base.configVersion !== current.configVersion ||
    JSON.stringify(base.configSchema ?? null) !== JSON.stringify(current.configSchema ?? null)
  );
};

export function createDraftLifecycle(deps: LifecycleDeps): DraftLifecycle {
  const apply = applyAndPublish(deps.store, deps.events, deps.clock);
  const paths = (d: ComponentDraft): DraftPaths => draftPaths(deps.home, d.id);
  const pending = new Set<Promise<void>>();
  const track = (work: Promise<void>) => {
    const p = work.catch((e: unknown) => console.error("[kibo-daemon] draft work failed", e));
    pending.add(p);
    void p.then(() => pending.delete(p));
  };
  const cancelLiveRun = (d: ComponentDraft) => {
    if (d.runId && LIVE_RUN.has(deps.runs.state(d.runId) ?? "")) deps.runs.cancel(d.runId);
  };

  const requireGenerator = () => {
    const s = deps.ai.status();
    if (!s.available) throw new KiboError("AI_UNAVAILABLE", `claude unavailable: ${s.reason ?? "unknown"}`);
    if (!s.profiles.generateur) throw new KiboError("AI_UNAVAILABLE", "generator profile is disabled");
  };

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

  const validate = async (id: string): Promise<void> => {
    const d = stillValidating(id);
    if (!d) return;
    const p = paths(d);
    try {
      if (d.mode === "modify" && configChanged(p)) {
        apply(d, { type: "config_changed" });
        return;
      }
      const report = await checkPermissions(id, p.dir);
      const current = stillValidating(id);
      if (!report || !current) return;
      deps.store.saveReport(id, report);
      apply(current, { type: "validated", ok: report.ok });
    } catch (e) {
      const current = stillValidating(id);
      if (current) apply(current, { type: "validation_crashed", detail: errorText(e) });
    }
  };

  const restoreAfterRun = (d: ComponentDraft): { incidents: DraftIncident[] } | { detail: string } => {
    try {
      return { incidents: verifyAndRestore(paths(d), d.withServer) };
    } catch (e) {
      return { detail: errorText(e) };
    }
  };

  const onRunEnd = async (id: string, runId: string, end: RunEnd): Promise<void> => {
    const before = deps.store.get(id);
    if (before.status !== "generating" || before.runId !== runId) return;
    const restored = restoreAfterRun(before);
    const ended = apply(before, {
      type: "run_ended",
      runId,
      state: end.state,
      sessionId: end.sessionId,
      error: end.error,
    });
    if ("incidents" in restored) {
      apply(ended, { type: "restored", incidents: restored.incidents });
      await validate(id);
    } else if (ended.status === "validating")
      apply(ended, { type: "validation_crashed", detail: restored.detail });
    else recovery.noteFailure(ended, restored.detail);
  };

  const launch = (d: ComponentDraft, prompt: string, resumeSessionId: string | null): ComponentDraft => {
    applyDraftEvent(d, { type: "enqueued", runId: "check" }, deps.clock.now());
    const p = paths(d);
    const runId = deps.runs.enqueue({
      profileId: "generateur",
      label: `Composant ${d.title}`,
      cwd: p.dir,
      prompt,
      args: deps.args(),
      env: deps.env(),
      resumeSessionId,
      guard: createDraftGuard({ draftDir: p.dir, readRoots: [deps.sdkDir], allowServer: d.withServer }),
    });
    const next = apply(d, { type: "enqueued", runId });
    deps.runs.onEnd(runId, (end) => track(onRunEnd(next.id, runId, end)));
    return next;
  };

  const prepare = (draft: ComponentDraft) =>
    prepareDraft({
      paths: paths(draft),
      kiboFiles: draftKiboFiles(brief(draft)),
      fill:
        draft.mode === "create"
          ? (dir) =>
              deps.devkit.scaffold({
                dir,
                id: draft.componentId,
                title: draft.title,
                kind: draft.kind,
                withServer: draft.withServer,
              })
          : async (dir) => copySource(deps.catalog.sourceDir(draft.componentId), dir),
    });

  const idle = async () => {
    while (pending.size > 0) await Promise.all([...pending]);
  };

  const recovery = createDraftRecovery({
    store: deps.store,
    catalog: deps.catalog,
    clock: deps.clock,
    events: deps.events,
    apply,
    paths,
    cancelLiveRun,
    revalidate: (id) => track(validate(id)),
  });

  return {
    async start(input) {
      requireGenerator();
      const draft = newDraft(input, {
        store: deps.store,
        catalog: deps.catalog,
        id: deps.newId(),
        now: deps.clock.now(),
      });
      deps.store.insert(draft);
      try {
        await prepare(draft);
      } catch (e) {
        const current = deps.store.get(draft.id);
        if (current.status === "describing") apply(current, { type: "abandoned" });
        throw e;
      }
      const current = deps.store.get(draft.id);
      if (current.status !== "describing") {
        removeDraft(paths(current));
        return current;
      }
      return launch(current, generatorPrompt(brief(current)), null);
    },

    retry(draftId) {
      requireGenerator();
      const d = deps.store.get(draftId);
      if (!canRetry(d)) throw new KiboError("INVALID_INPUT", "this draft cannot be retried");
      const report = deps.store.report(draftId);
      const prompt = report && !report.ok ? fixPrompt(report) : generatorPrompt(brief(d));
      return launch(d, prompt, d.sessionId);
    },

    async revalidate(draftId) {
      apply(deps.store.get(draftId), { type: "validation_started" });
      await validate(draftId);
      return deps.store.get(draftId);
    },

    abandon(draftId) {
      recovery.abandon(deps.store.get(draftId));
      return null;
    },

    async openFolder(draftId) {
      const d = deps.store.get(draftId);
      if (!isActive(d)) throw new KiboError("INVALID_INPUT", `draft is ${d.status}`);
      await deps.editor.openFolder(paths(d).dir);
      return null;
    },

    list: () => deps.store.list(),

    async recover() {
      recovery.recoverAll();
      await idle();
    },

    idle,
  };
}
