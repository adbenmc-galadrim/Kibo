import type { AgentsState, Session } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { fr } from "../i18n/fr";
import { RunHistoryList } from "./lazy-screens";
import { markSeen, readSeenAt, runHistory, unseenCount } from "./run-history";

type Props = {
  agents: AgentsState | null;
  notifications: Session["notifications"];
  now: number;
  onOpenRun(runId: string): void;
};

export function RunHistoryButton({ agents, notifications, now, onOpenRun }: Props) {
  const [seenAt, setSeenAt] = useState(readSeenAt);
  const [open, setOpen] = useState(false);
  const runs = useMemo(() => (agents ? runHistory(agents) : []), [agents]);
  const unseen = agents ? unseenCount(runs, seenAt) : 0;
  const label = unseen > 0 ? `${fr.header.runHistory} · ${fr.header.unseen(unseen)}` : fr.header.runHistory;
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      markSeen(now);
      setSeenAt(now);
    }
  };
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative size-7"
          aria-label={label}
          disabled={agents === null}
        >
          <Bell />
          {unseen > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-3.5 place-items-center rounded-full bg-brand px-0.5 text-3xs font-semibold text-white">
              {unseen}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-90" aria-label={fr.header.runHistory}>
        {open && <RunHistoryList runs={runs} now={now} notifications={notifications} onOpenRun={onOpenRun} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
