import type { ComponentDraft, ValidationReport } from "@kibo/schema";
import { clearUnrestored, type DraftPaths, markUnrestored } from "./draft-files";
import { assertRealDir, isRealDir } from "./draft-fs";
import { createDraftGuard } from "./draft-guard";
import { applyDraftEvent, type DraftEvent } from "./draft-machine";
import type { AgentRuns, Clock, RunEnd } from "./ports";
import { fixPrompt, type GeneratorBrief, generatorPrompt, revisePrompt } from "./prompts";

export const ATTACHMENTS_ENV = "KIBO_DRAFT_ATTACHMENTS";

export type LaunchInput = {
  draft: ComponentDraft;
  sdkDir: string;
  prompt: string;
  resumeSessionId: string | null;
  event: "enqueued" | "revised";
};

export type LaunchDeps = {
  runs: AgentRuns;
  clock: Clock;
  args: () => string[];
  env: () => Record<string, string>;
  paths: (d: ComponentDraft) => DraftPaths;
  apply: (d: ComponentDraft, e: DraftEvent) => ComponentDraft;
  onEnd: (draftId: string, runId: string, end: RunEnd) => void;
};

export const draftBrief = (d: ComponentDraft, attachments: readonly string[]): GeneratorBrief => ({
  mode: d.mode,
  componentId: d.componentId,
  title: d.title,
  kind: d.kind,
  withServer: d.withServer,
  description: d.description,
  baseVersion: d.baseVersion,
  attachments,
});

const readRoots = (sdkDir: string, p: DraftPaths): string[] =>
  isRealDir(p.attachmentsDir) ? [sdkDir, p.attachmentsDir] : [sdkDir];

export function launchDraft(deps: LaunchDeps, input: LaunchInput): ComponentDraft {
  const d = input.draft;
  applyDraftEvent(d, { type: input.event, runId: "check" }, deps.clock.now());
  const p = deps.paths(d);
  assertRealDir(p.dir);
  const guard = createDraftGuard({
    draftDir: p.dir,
    readRoots: readRoots(input.sdkDir, p),
    allowServer: d.withServer,
  });
  markUnrestored(p);
  let runId: string;
  try {
    runId = deps.runs.enqueue({
      profileId: "generateur",
      label: `Composant ${d.title}`,
      cwd: p.dir,
      prompt: input.prompt,
      args: deps.args(),
      env: { ...deps.env(), [ATTACHMENTS_ENV]: p.attachmentsDir },
      resumeSessionId: input.resumeSessionId,
      guard,
    });
  } catch (e) {
    clearUnrestored(p);
    throw e;
  }
  const next = deps.apply(d, { type: input.event, runId });
  deps.runs.onEnd(runId, (end) => deps.onEnd(next.id, runId, end));
  return next;
}

export function retryPrompt(
  d: ComponentDraft,
  context: { report: ValidationReport | null; feedback: string | null; images: readonly string[] },
): string {
  if (context.report && !context.report.ok) return fixPrompt(context.report);
  if (d.revisions > 0 && context.feedback !== null)
    return revisePrompt(draftBrief(d, []), context.feedback, context.images);
  return generatorPrompt(draftBrief(d, context.images));
}
