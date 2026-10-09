import type { Change, ChangeKind } from "./reconcile";

const KIBO_WINS = "(Kibo)";

export const CHANGE_KINDS: readonly ChangeKind[] = [
  "created",
  "updated",
  "kept",
  "orphan",
  "drift",
  "migrated",
];
export type ImportReport = Record<ChangeKind, number> & { lines: string[] };

export function buildReport(changes: readonly Change[]): ImportReport {
  const count = (kind: ChangeKind) => changes.filter((c) => c.kind === kind).length;
  return {
    created: count("created"),
    updated: count("updated"),
    kept: count("kept"),
    orphan: count("orphan"),
    drift: count("drift"),
    migrated: count("migrated"),
    lines: changes
      .filter((c) => c.kind !== "kept" || c.detail.includes(KIBO_WINS))
      .map((c) => `${c.kind} ${c.what}${c.detail ? ` · ${c.detail}` : ""}`),
  };
}

export function printReport(report: ImportReport, print: (line: string) => void): void {
  print(CHANGE_KINDS.map((k) => `${k} ${report[k]}`).join(" · "));
  for (const line of report.lines) print(line);
}
