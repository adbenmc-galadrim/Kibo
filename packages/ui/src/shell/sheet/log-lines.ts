import type { CiLog } from "@kibo/schema";

export type LogLine = { n: number; text: string; error: boolean };

const GITHUB_STAMP = /^\uFEFF?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+Z/;
const shortStamp = (line: string) => line.replace(GITHUB_STAMP, "$1Z");

export function visibleLines(log: CiLog, query: string, errorsOnly: boolean): LogLine[] {
  const errors = new Set(log.errorLines);
  const q = query.trim().toLowerCase();
  return log.text
    .replace(/\n$/, "")
    .split("\n")
    .map((text, i) => ({ n: i + 1, text: shortStamp(text), error: errors.has(i + 1) }))
    .filter((l) => (!errorsOnly || l.error) && (q === "" || l.text.toLowerCase().includes(q)));
}
