import {
  type ComponentDraft,
  type DraftIncident,
  KiboError,
  type StartComponentDraftInput,
} from "@kibo/schema";
import {
  clearUnrestored,
  copySource,
  type DraftPaths,
  draftPaths,
  isUnrestored,
  markUnrestored,
  prepareDraft,
  removeDraft,
  verifyAndRestore,
} from "./draft-files";
import { createDraftGuard } from "./draft-guard";
import { applyDraftEvent, canRetry, type DraftEvent, isActive } from "./draft-machine";
import { newDraft } from "./draft-new";
import { createDraftRecovery, errorText } from "./draft-recovery";
import type { DraftStore } from "./draft-store";
import { createDraftValidation } from "./draft-validation";
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
  restore?: (paths: DraftPaths, allowServer: boolean) => DraftIncident[];
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

export function createDraftLifecycle(deps: LifecycleDeps): DraftLifecycle {
  const apply = applyAndPublish(deps.store, deps.events, deps.clock);
  const paths = (d: ComponentDraft): DraftPaths => draftPaths(deps.home, d.id);
  const restore = deps.restore ?? verifyAndRestore;
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

  const validate = createDraftValidation({ store: deps.store, devkit: deps.devkit, apply, paths });

  const restoreDraft = (d: ComponentDraft): DraftIncident[] => {
    const incidents = restore(paths(d), d.withServer);
    clearUnrestored(paths(d));
    return incidents;
  };

  const restoreAfterRun = (d: ComponentDraft): { incidents: DraftIncident[] } | { detail: string } => {
    try {
      return { incidents: restoreDraft(d) };
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
    markUnrestored(p);
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
    restore: restoreDraft,
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
      const restored = isUnrestored(paths(d)) ? restoreAfterRun(d) : { incidents: [] };
      if ("detail" in restored) {
        recovery.noteFailure(d, restored.detail);
        return deps.store.get(draftId);
      }
      const report = deps.store.report(draftId);
      const prompt = report && !report.ok ? fixPrompt(report) : generatorPrompt(brief(d));
      return launch(d, prompt, d.sessionId);
    },

    async revalidate(draftId) {
      const started = apply(deps.store.get(draftId), { type: "validation_started" });
      const restored = isUnrestored(paths(started)) ? restoreAfterRun(started) : { incidents: [] };
      if ("detail" in restored) apply(started, { type: "validation_crashed", detail: restored.detail });
      else {
        const found = restored.incidents;
        if (found.length > 0)
          apply(started, { type: "restored", incidents: [...started.incidents, ...found] });
        await validate(draftId);
      }
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
