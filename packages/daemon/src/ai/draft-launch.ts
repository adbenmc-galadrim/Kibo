import type { ComponentDraft } from "@kibo/schema";
import { type DraftPaths, markUnrestored } from "./draft-files";
import { isRealDir } from "./draft-fs";
import { createDraftGuard } from "./draft-guard";
import { applyDraftEvent, type DraftEvent } from "./draft-machine";
import type { AgentRuns, Clock, RunEnd } from "./ports";
import type { GeneratorBrief } from "./prompts";

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
  markUnrestored(p);
  const runId = deps.runs.enqueue({
    profileId: "generateur",
    label: `Composant ${d.title}`,
    cwd: p.dir,
    prompt: input.prompt,
    args: deps.args(),
    env: { ...deps.env(), [ATTACHMENTS_ENV]: p.attachmentsDir },
    resumeSessionId: input.resumeSessionId,
    guard: createDraftGuard({
      draftDir: p.dir,
      readRoots: readRoots(input.sdkDir, p),
      allowServer: d.withServer,
    }),
  });
  const next = deps.apply(d, { type: input.event, runId });
  deps.runs.onEnd(runId, (end) => deps.onEnd(next.id, runId, end));
  return next;
}
