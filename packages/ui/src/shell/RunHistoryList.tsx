import { type RunView, runSubject, type Session } from "@kibo/schema";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@kibo/sdk/ui/dropdown-menu";
import { fr } from "../i18n/fr";
import { relativeTime } from "../lib/relative-time";
import { NotifyButton } from "./NotifyButton";
import { runMoment } from "./run-history";

type Props = {
  runs: RunView[];
  now: number;
  notifications: Session["notifications"];
  onOpenRun(runId: string): void;
};

export function RunHistoryList({ runs, now, notifications, onOpenRun }: Props) {
  return (
    <>
      <DropdownMenuLabel>{fr.header.runHistory}</DropdownMenuLabel>
      {runs.length === 0 && (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">{fr.header.noRuns}</p>
      )}
      {runs.map((run) => (
        <DropdownMenuItem key={run.id} className="grid gap-0.5" onSelect={() => onOpenRun(run.id)}>
          <span className="truncate text-sm">
            {run.label} · {runSubject(run, fr.agents.states[run.state])} · {relativeTime(runMoment(run), now)}
          </span>
          {run.state === "waiting_input" && <span className="text-xs text-brand">{fr.header.reply}</span>}
        </DropdownMenuItem>
      ))}
      {notifications === "browser" && (
        <>
          <DropdownMenuSeparator />
          <div className="flex justify-end px-1 py-0.5">
            <NotifyButton />
          </div>
        </>
      )}
    </>
  );
}
