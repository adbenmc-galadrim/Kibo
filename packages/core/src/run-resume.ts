import type { RunView } from "@kibo/schema";
import { canWriteAfterEnd } from "./run-machine";

export type ResumeContext = {
  runs: readonly RunView[];
  alive: (runId: string) => boolean;
  profileIds: ReadonlySet<string>;
};

export function isLatestOfTicket(run: RunView, runs: readonly RunView[]): boolean {
  return !runs.some((r) => r.seq > run.seq && r.projectId === run.projectId && r.ticketId === run.ticketId);
}

export function canResume(run: RunView, ctx: ResumeContext): boolean {
  return (
    canWriteAfterEnd(run) &&
    !ctx.alive(run.id) &&
    ctx.profileIds.has(run.profileId) &&
    isLatestOfTicket(run, ctx.runs)
  );
}

export function resumableRuns(ctx: ResumeContext): string[] {
  return ctx.runs.filter((r) => canResume(r, ctx)).map((r) => r.id);
}
