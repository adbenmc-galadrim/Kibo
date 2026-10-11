import { KiboError, PROGRESS_TOOL_NAME, ProgressInput, type RunView } from "@kibo/schema";
import type { z } from "zod";
import type { ProgressService } from "./service";

const issueText = (issue: z.ZodIssue): string =>
  issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;

export async function handleTicketTool(
  service: Pick<ProgressService, "record">,
  run: RunView,
  tool: string,
  input: unknown,
): Promise<string> {
  if (tool !== PROGRESS_TOOL_NAME) throw new KiboError("NOT_FOUND", `tool ${tool} not found`);
  const parsed = ProgressInput.safeParse(input);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.issues.map(issueText).join("; "));
  return service.record(run, parsed.data);
}
