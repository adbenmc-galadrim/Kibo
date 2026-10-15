import type { RunSubagentSummary } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { frSubagents } from "../../i18n/fr-subagents";

type Props = {
  subagents: readonly RunSubagentSummary[];
  now: number;
  tabIndex?: number;
  className?: string;
  onOpen(subagentId: string): void;
};

export function activeByRun(subagents: readonly RunSubagentSummary[]): Map<string, RunSubagentSummary[]> {
  const byRun = new Map<string, RunSubagentSummary[]>();
  for (const s of subagents)
    if (s.state === "running") byRun.set(s.runId, [...(byRun.get(s.runId) ?? []), s]);
  return byRun;
}

export function SubagentLines({ subagents, now, tabIndex, className, onOpen }: Props) {
  if (subagents.length === 0) return null;
  return (
    <ul className={cn("grid", className)}>
      {subagents.map((s) => (
        <li key={s.id} className="flex h-4 items-center">
          <button
            type="button"
            tabIndex={tabIndex}
            aria-label={frSubagents.open(s.type, s.description)}
            onClick={() => onOpen(s.id)}
            className="flex min-w-0 items-center gap-1 whitespace-nowrap text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden>↳</span>
            <span className="font-mono font-medium text-brand-strong dark:text-brand">{s.type}</span>
            <span className="truncate">{frSubagents.line(s.description, now - s.startedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
