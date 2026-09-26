import { useDraggable } from "@dnd-kit/core";
import type { CiRun, Status, StatusId, TicketRun, TicketView } from "@kibo/schema";
import { AgentBadge } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { fr } from "./fr";

const CI_DOT = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  running: "bg-amber-500",
  neutral: "bg-zinc-400",
} as const;

function ciTone(run: Pick<CiRun, "status" | "conclusion">): keyof typeof CI_DOT {
  if (run.status !== "completed") return "running";
  if (run.conclusion === "success") return "ok";
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure")
    return "error";
  return "neutral";
}

type Props = {
  ticket: TicketView;
  run: TicketRun | null;
  ci?: CiRun;
  statuses: Status[];
  onOpen: () => void;
  onMove: (statusId: StatusId) => void;
};

export function KanbanCard({ ticket: t, run, ci, statuses, onOpen, onMove }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: t.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <article
      ref={setNodeRef}
      style={style}
      className="grid gap-2 rounded-md border bg-card p-2.5 text-sm shadow-xs"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xs text-muted-foreground" {...listeners} {...attributes}>
          {t.key}
        </span>
        <span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-6" aria-label={fr.actions(t.key)}>
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{fr.moveTo}</DropdownMenuLabel>
            {statuses
              .filter((s) => s.id !== t.statusId)
              .map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => onMove(s.id)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button type="button" className="text-left" onClick={onOpen}>
        {t.title}
      </button>
      {t.blockedReason && (
        <p className="text-2xs text-red-600 dark:text-red-400">{fr.blockedReason(t.blockedReason)}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <AgentBadge agent={t.assignee?.kind === "agent" ? t.assignee.ref : null} run={run} texts={fr.run} />
        {t.waitingOn.map((k) => (
          <Badge key={k} variant="outline" className="text-3xs">
            {fr.waitingOn(k)}
          </Badge>
        ))}
        {ci && (
          <span
            title={fr.ci[ciTone(ci)]}
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-3xs"
          >
            <span
              role="img"
              aria-label={fr.ci[ciTone(ci)]}
              className={`size-2 rounded-full ${CI_DOT[ciTone(ci)]}`}
            />
            {ci.prNumber !== null && `#${ci.prNumber}`}
          </span>
        )}
        {t.progress.total > 0 && (
          <span className="ml-auto font-mono text-3xs text-muted-foreground">{`${t.progress.done}/${t.progress.total}`}</span>
        )}
      </div>
    </article>
  );
}
