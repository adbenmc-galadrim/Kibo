import type { CiLog } from "@kibo/schema";

export type LogLine = { n: number; text: string; error: boolean };

export function visibleLines(log: CiLog, query: string, errorsOnly: boolean): LogLine[] {
  const errors = new Set(log.errorLines);
  const q = query.trim().toLowerCase();
  return log.text
    .replace(/\n$/, "")
    .split("\n")
    .map((text, i) => ({ n: i + 1, text, error: errors.has(i + 1) }))
    .filter((l) => (!errorsOnly || l.error) && (q === "" || l.text.toLowerCase().includes(q)));
}
