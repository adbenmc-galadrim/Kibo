import { FINAL_STATUSES } from "@kibo/schema";
import { DELIVERY_STEP_CHIP } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { CircleCheck, CircleX, GitBranch, GitPullRequest, Lock, Pause } from "lucide-react";
import { frMine as t } from "../i18n/fr-mine";
import { stepLine } from "../ticket/tracking-model";
import type { WorkItem } from "./work-list";

const BADGE =
  "inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium leading-none whitespace-nowrap";
const OUTLINED = cn(BADGE, "border border-(--tracking-border) text-(--tracking-mfg)");
const RED = cn(BADGE, "bg-(--tracking-red-soft) text-(--tracking-red)");

function waitingText(item: WorkItem): string | null {
  const { ticket } = item;
  if (item.blockedBy !== null) return t.blockedBy(item.blockedBy);
  if (ticket.onHold !== null) return t.reason({ kind: "onHold", hold: ticket.onHold });
  if (ticket.statusId === "blocked") return t.blocked;
  if (ticket.startReason) return t.reason(ticket.startReason);
  return ticket.waitingOn.length > 0 ? t.waitingOn(ticket.waitingOn) : null;
}

function CiBadge({ tone }: { tone: NonNullable<WorkItem["ci"]> }) {
  const Icon = tone === "error" ? CircleX : CircleCheck;
  return (
    <span data-ci={tone} className={tone === "error" ? RED : OUTLINED}>
      {(tone === "error" || tone === "ok") && (
        <Icon
          aria-hidden
          absoluteStrokeWidth
          size={11}
          className={cn("size-[11px]", tone === "ok" && "text-(--tracking-green)")}
        />
      )}
      {t.ci[tone]}
    </span>
  );
}

function PhaseChip({ ticket }: { ticket: WorkItem["ticket"] }) {
  if (ticket.delivery === null || FINAL_STATUSES.includes(ticket.statusId)) return null;
  return (
    <span data-delivery-step="" className={cn(DELIVERY_STEP_CHIP, "shrink-0 whitespace-nowrap")}>
      {stepLine(ticket.delivery)}
    </span>
  );
}

export function WorkBadges({ item, waiting }: { item: WorkItem; waiting: boolean }) {
  const reason = waiting ? waitingText(item) : null;
  return (
    <span className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden">
      {item.branch && (
        <span className={cn(OUTLINED, "min-w-0 max-w-[180px]")}>
          <GitBranch
            aria-hidden
            absoluteStrokeWidth
            size={11}
            className="size-[11px] shrink-0 text-(--tracking-blue)"
          />
          <span className="truncate font-mono text-(--tracking-fg)">{item.branch}</span>
        </span>
      )}
      <PhaseChip ticket={item.ticket} />
      {item.pr && (
        <span data-pr={item.pr.state} className={OUTLINED}>
          <GitPullRequest
            aria-hidden
            absoluteStrokeWidth
            size={11}
            className="size-[11px] text-(--tracking-purple)"
          />
          <span className="font-mono text-(--tracking-fg)">{`#${item.pr.number}`}</span>
        </span>
      )}
      {item.changes && (
        <span className={cn(BADGE, "bg-(--tracking-amber-soft) text-(--tracking-amber)")}>
          {t.changesRequested}
        </span>
      )}
      {item.ci && <CiBadge tone={item.ci} />}
      {reason && (
        <span className={item.blockedBy !== null || item.ticket.statusId === "blocked" ? RED : OUTLINED}>
          {(item.blockedBy !== null || item.ticket.statusId === "blocked") && (
            <Lock aria-hidden absoluteStrokeWidth size={11} className="size-[11px]" />
          )}
          {item.blockedBy === null && item.ticket.statusId !== "blocked" && item.ticket.onHold !== null && (
            <Pause aria-hidden absoluteStrokeWidth size={11} className="size-[11px]" />
          )}
          {reason}
        </span>
      )}
    </span>
  );
}
