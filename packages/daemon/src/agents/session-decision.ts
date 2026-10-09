import type { RunRecord, RunView, SessionFreshReason, SessionPreview } from "@kibo/schema";

export type SessionDecision =
  | { resume: true; sessionId: string; from: string }
  | { resume: false; sessionId: string; reason: SessionFreshReason };

export type TranscriptCheck = (path: string | null) => boolean;

type DecisionInput = {
  run: RunRecord;
  previous: RunView | null;
  cwd: string;
  transcriptExists: TranscriptCheck;
  newId: () => string;
};

type ResumeCheck = { profileId: string; cwd: string | null; transcriptExists: TranscriptCheck };

function resumeBlocker(previous: RunView, check: ResumeCheck): SessionFreshReason | null {
  if (previous.profileId !== check.profileId) return "profile_changed";
  if (!check.transcriptExists(previous.transcriptPath)) return "transcript_missing";
  if (check.cwd === null || previous.cwd !== check.cwd) return "workspace_changed";
  return null;
}

function ownReason(run: RunRecord, previous: RunView | null): SessionFreshReason {
  if (previous === null) return "no_previous";
  return previous.profileId === run.profileId ? "user_reset" : "profile_changed";
}

export function decideSession(input: DecisionInput): SessionDecision {
  const { run, previous } = input;
  if (run.resumedFrom === null || previous === null || previous.id !== run.resumedFrom)
    return { resume: false, sessionId: run.sessionId, reason: ownReason(run, previous) };
  const reason = resumeBlocker(previous, {
    profileId: run.profileId,
    cwd: input.cwd,
    transcriptExists: input.transcriptExists,
  });
  if (reason === null) return { resume: true, sessionId: run.sessionId, from: previous.id };
  return { resume: false, sessionId: input.newId(), reason };
}

export function sessionPreview(main: RunView | null, check: ResumeCheck): SessionPreview | null {
  if (main === null) return null;
  const reason = resumeBlocker(main, check);
  return {
    runId: main.id,
    label: main.label,
    turns: main.turns,
    tokens: main.tokens,
    resumable: reason === null,
    reason,
  };
}
