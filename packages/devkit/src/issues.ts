import { z } from "zod";

export const SourceIssueCode = z.enum([
  "forbidden-import",
  "outside-import",
  "non-literal-import",
  "banned-identifier",
  "non-literal-argument",
  "reserved-command",
  "unknown-entity",
  "inference-skipped",
]);
export type SourceIssueCode = z.infer<typeof SourceIssueCode>;

export const SourceIssue = z.object({
  file: z.string(),
  line: z.number(),
  code: SourceIssueCode,
  detail: z.string(),
});
export type SourceIssue = z.infer<typeof SourceIssue>;

export const issueAt = (file: string, line: number, code: SourceIssueCode, detail: string): SourceIssue => ({
  file,
  line,
  code,
  detail,
});
