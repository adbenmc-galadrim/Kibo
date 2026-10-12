import { type RunView, runSubject } from "@kibo/schema";
import { RUN_TEXT, RunDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../../i18n/fr";
import { frMoments } from "../../i18n/fr-moments";
import { runScopeText } from "../catalog/agent-labels";
import { formatClock } from "../format";

type Props = {
  run: RunView;
  onOpenTicket(projectId: string, ticketId: string): void;
  children?: ReactNode;
};

function TicketLink({ run, onOpenTicket }: Pick<Props, "run" | "onOpenTicket">) {
  const { projectId, ticketId } = run;
  if (!projectId || !ticketId) return <span>{runSubject(run)}</span>;
  return (
    <button
      type="button"
      className="max-w-full truncate rounded-sm hover:text-foreground hover:underline"
      onClick={() => onOpenTicket(projectId, ticketId)}
    >
      {runSubject(run)}
    </button>
  );
}

export function RunHeading({ run, onOpenTicket, children }: Props) {
  return (
    <header className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15">
        <Bot aria-hidden className="size-4 text-brand-strong dark:text-brand" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate font-mono text-lg font-semibold">{run.label}</h2>
          <Badge
            variant="outline"
            className={cn("shrink-0 gap-1 text-[11px] font-normal", RUN_TEXT[run.state])}
          >
            <RunDot state={run.state} className="size-1.5" />
            {fr.agents.states[run.state]}
          </Badge>
        </div>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          <span className="shrink-0">{frMoments.run.agent(run.agentName, runScopeText(run))}</span>
          <span aria-hidden>·</span>
          <TicketLink run={run} onOpenTicket={onOpenTicket} />
          {run.startedAt !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="shrink-0 font-mono">
                {frMoments.run.startedAt(formatClock(run.startedAt))}
              </span>
            </>
          )}
        </p>
      </div>
      {children}
    </header>
  );
}
