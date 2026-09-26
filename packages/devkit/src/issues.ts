export type SourceIssueCode =
  | "forbidden-import"
  | "outside-import"
  | "non-literal-import"
  | "banned-identifier"
  | "non-literal-argument"
  | "reserved-command"
  | "unknown-entity";

export type SourceIssue = { file: string; line: number; code: SourceIssueCode; detail: string };

export const issueAt = (file: string, line: number, code: SourceIssueCode, detail: string): SourceIssue => ({
  file,
  line,
  code,
  detail,
});
