import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CiTone, MemberInfo, StatusId, TicketRun, TicketView } from "@kibo/schema";
import { liveRun, type QuestionsChipData, TicketKeyLabel, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Plus } from "lucide-react";
import { CELL, ROW, TEXT_12 } from "./columns";
import { DeliveryCell } from "./DeliveryCell";
import { FeatureChip, type FeatureRef } from "./FeatureChip";
import { updatedAt } from "./filter-tickets";
import { fr } from "./fr";
import { GitPrCell } from "./GitPrCell";
import { RowDetails } from "./RowDetails";
import { TicketRowActions, TicketRowMenu } from "./TicketRowMenu";
import { zoneId } from "./tree-drop";
import { updatedLabel } from "./updated-label";

const STATE_DOT: Record<StatusId, string> = {
  backlog: "border-[1.5px] border-(--tracking-faint)",
  todo: "border-[1.5px] border-(--tracking-dim)",
  in_progress: "bg-(--tracking-blue)",
  in_review: "bg-(--tracking-purple)",
  blocked: "bg-(--tracking-red)",
  done: "bg-(--tracking-green)",
};

export type RowFacts = {
  ticket: TicketView;
  feature: FeatureRef | null;
  ci: CiTone | null;
  run: TicketRun | null;
  members: MemberInfo[];
  statusLabel: string;
  entries: MenuEntry[];
  readOnly: boolean;
  canDrag: boolean;
  questions: QuestionsChipData;
  selected: boolean | null;
  dimmed: boolean;
  now: number;
};

function DropZones({ id, enabled }: { id: string; enabled: boolean }) {
  const before = useDroppable({ id: zoneId({ kind: "before", ticketId: id }), disabled: !enabled });
  const inside = useDroppable({ id: zoneId({ kind: "inside", ticketId: id }), disabled: !enabled });
  const after = useDroppable({ id: zoneId({ kind: "after", ticketId: id }), disabled: !enabled });
  return (
    <>
      <div
        ref={before.setNodeRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/4"
      />
      <div
        ref={inside.setNodeRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/4 h-1/2"
      />
      <div
        ref={after.setNodeRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
      />
      {inside.isOver && (
        <span aria-hidden className="pointer-events-none absolute inset-0 ring-2 ring-ring ring-inset" />
      )}
      {before.isOver && (
        <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded bg-ring" />
      )}
      {after.isOver && (
        <span aria-hidden className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded bg-ring" />
      )}
    </>
  );
}

export function TicketRow(props: RowFacts) {
  const { ticket: t, feature, ci, run, statusLabel, entries, readOnly, canDrag, questions } = props;
  const sdk = useSdk();
  const drag = useDraggable({ id: t.id, disabled: !canDrag });
  const handle = canDrag ? { ...drag.listeners, ...drag.attributes } : {};
  const done = t.statusId === "done";
  const running = liveRun(run) !== null;
  const at = updatedAt(t);
  return (
    <li>
      <TicketRowMenu entries={entries}>
        <div
          data-selected={props.selected === true}
          className={cn(
            ROW,
            "group relative h-[41px] border-t border-(--tracking-soft) hover:bg-(--tracking-hover)",
            props.selected === true && "bg-(--tracking-muted)",
            props.dimmed && "opacity-50",
          )}
        >
          <DropZones id={t.id} enabled={canDrag} />
          <span className={CELL.key} ref={drag.setNodeRef} {...handle} aria-describedby={undefined}>
            <TicketKeyLabel
              ticket={t}
              className={cn("font-mono", TEXT_12, done ? "text-(--tracking-dim)" : "text-(--tracking-mfg)")}
            />
          </span>
          <span data-cell="title" className={cn(CELL.title, "relative")}>
            <RowDetails ticket={t} run={run} members={props.members} questions={questions}>
              <button
                type="button"
                data-row-title
                className={cn(
                  "min-w-0 truncate text-left text-[13px] leading-[1.2]",
                  done ? "text-(--tracking-mfg)" : "text-(--tracking-fg)",
                )}
                onClick={() => sdk.openTicket(t.id)}
              >
                {t.title}
              </button>
            </RowDetails>
            {feature && (
              <span data-slot="feature-inline" className="flex min-w-0 shrink @xl:hidden">
                <FeatureChip feature={feature} onOpen={(id) => sdk.openTicket(id)} />
              </span>
            )}
            {running && (
              <span
                role="img"
                aria-label={fr.running}
                className="size-[7px] shrink-0 rounded-full bg-(--tracking-brand)"
              />
            )}
            <span className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center rounded-[6px] bg-(--tracking-hover) opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  aria-label={fr.newSubTicket(t.keyLabel)}
                  onClick={() => sdk.openNewTicket({ parentId: t.id })}
                >
                  <Plus absoluteStrokeWidth size={14} className="size-3.5" />
                </Button>
              )}
              <TicketRowActions entries={entries} label={fr.actions(t.keyLabel)} readOnly={readOnly} />
            </span>
          </span>
          <span data-cell="feature" className={CELL.feature}>
            {feature && <FeatureChip feature={feature} onOpen={(id) => sdk.openTicket(id)} />}
          </span>
          <span data-cell="status" className={CELL.status}>
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATE_DOT[t.statusId])} />
            <span
              className={cn(
                "truncate text-[12.5px] leading-[1.2]",
                done ? "text-(--tracking-mfg)" : "text-(--tracking-fg)",
              )}
            >
              {statusLabel}
            </span>
          </span>
          <span data-cell="git" className={CELL.git}>
            <GitPrCell ticket={t} ci={ci} />
          </span>
          <span data-cell="delivery" className={CELL.delivery}>
            <DeliveryCell delivery={t.delivery} />
          </span>
          <span data-cell="updated" className={cn(CELL.updated, TEXT_12, "text-(--tracking-dim)")}>
            {at === null ? fr.none : updatedLabel(at, props.now)}
          </span>
        </div>
      </TicketRowMenu>
    </li>
  );
}
