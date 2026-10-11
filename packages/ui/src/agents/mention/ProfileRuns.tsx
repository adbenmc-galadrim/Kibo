import type { AgentsState, RunView } from "@kibo/schema";
import { RUN_TEXT, RunDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { frMoments } from "../../i18n/fr-moments";
import { runStateText } from "../format";
import { Mention } from "./Mention";
import { newestFirst } from "./use-run-view";

const formatWhen = (at: number): string =>
  new Date(at).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function stateLine(run: RunView, agents: AgentsState): string {
  const report = agents.progress.find((p) => p.runId === run.id)?.report;
  if (run.state === "done" && report) return frMoments.dock.reportLine(report.toCheck, report.undeclared);
  return runStateText(run, agents.questions).text;
}

type ListProps = { label: string; runs: readonly RunView[]; current: string; agents: AgentsState };

export function RunList({ label, runs, current, agents }: ListProps) {
  return (
    <ul aria-label={label} className="grid gap-0.5">
      {newestFirst(runs).map((run) => (
        <li
          key={run.id}
          data-run={run.id}
          aria-current={run.id === current ? "true" : undefined}
          className={cn(
            "grid grid-cols-[0.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 text-xs",
            run.id === current && "bg-accent",
          )}
        >
          <RunDot state={run.state} />
          <span className="flex min-w-0 items-center gap-2">
            <Mention runId={run.id} label={run.label} className="text-[13px] font-medium" />
            {run.ticketKey && (
              <span className="shrink-0 font-mono text-muted-foreground">{run.ticketKey}</span>
            )}
          </span>
          <span className="col-start-2 flex min-w-0 items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate", RUN_TEXT[run.state])}>
              {stateLine(run, agents)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {formatWhen(run.startedAt ?? run.createdAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Props = { run: RunView; agents: AgentsState };

export function ProfileRuns({ run, agents }: Props) {
  const label = frMoments.run.history;
  return (
    <section className="grid content-start gap-2">
      <h3 className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</h3>
      <RunList
        label={label}
        runs={agents.runs.filter((r) => r.profileId === run.profileId)}
        current={run.id}
        agents={agents}
      />
    </section>
  );
}
