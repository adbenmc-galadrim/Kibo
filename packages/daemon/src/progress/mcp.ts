import {
  KiboError,
  PEEK_WORK_TOOL_NAME,
  PROGRESS_TOOL_NAME,
  ProgressInput,
  type RunView,
  SIGNAL_TOOL_NAME,
  SKILL_REVIEW_TOOL_NAME,
} from "@kibo/schema";
import type { z } from "zod";
import type { SignalService } from "../signals/service";
import type { SkillReviews } from "../skills/reviews";
import type { ProgressService } from "./service";

export type TicketToolServices = {
  progress: Pick<ProgressService, "record">;
  signals: Pick<SignalService, "record">;
  reviews: Pick<SkillReviews, "record">;
  peek: { call(run: RunView, input: unknown): Promise<string> };
};

const issueText = (issue: z.ZodIssue): string =>
  issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;

function recordProgress(
  progress: TicketToolServices["progress"],
  run: RunView,
  input: unknown,
): Promise<string> {
  const parsed = ProgressInput.safeParse(input);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.issues.map(issueText).join("; "));
  return progress.record(run, parsed.data);
}

export async function handleTicketTool(
  services: TicketToolServices,
  run: RunView,
  tool: string,
  input: unknown,
): Promise<string> {
  if (tool === PROGRESS_TOOL_NAME) return recordProgress(services.progress, run, input);
  if (tool === SIGNAL_TOOL_NAME) return services.signals.record(run, input);
  if (tool === SKILL_REVIEW_TOOL_NAME) return services.reviews.record(run, input);
  if (tool === PEEK_WORK_TOOL_NAME) return services.peek.call(run, input);
  throw new KiboError("NOT_FOUND", `tool ${tool} not found`);
}
