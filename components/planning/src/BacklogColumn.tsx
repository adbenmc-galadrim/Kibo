import { useDroppable } from "@dnd-kit/core";
import { cn } from "@kibo/sdk/lib/utils";
import { useAutoAnimate } from "@kibo/sdk/ui/auto-animate";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { BACKLOG_ID } from "./drag";
import { fr } from "./fr";
import { CARD_LIST_CLASS, COLUMN_CLASS, DropZone } from "./SprintColumn";

type Props = { dropping: boolean; empty: boolean; children: ReactNode; footer?: ReactNode };

export function BacklogColumn({ dropping, empty, children, footer }: Props) {
  const { setNodeRef } = useDroppable({ id: BACKLOG_ID });
  const [cards] = useAutoAnimate<HTMLDivElement>();
  return (
    <section
      ref={setNodeRef}
      aria-label={fr.backlog}
      className={cn(
        COLUMN_CLASS,
        "sticky left-0 z-10 border-(--tracking-border) border-dashed bg-(--tracking-bg) shadow-[12px_0_0_var(--tracking-bg)]",
      )}
    >
      <header className="flex flex-col gap-1 px-0.5 pt-0.5 pb-1">
        <div className="flex h-4 items-center gap-1.5">
          <Inbox absoluteStrokeWidth size={14} aria-hidden className="text-(--tracking-mfg)" />
          <span className="font-semibold text-(--tracking-fg) text-[13px] leading-[16px]">{fr.backlog}</span>
        </div>
        <span className="whitespace-nowrap text-(--tracking-dim) text-[11.5px] leading-[14px]">
          {fr.backlogHint}
        </span>
      </header>
      <div ref={cards} data-slot="planning-cards" className={CARD_LIST_CLASS}>
        {children}
      </div>
      {dropping && <DropZone label={fr.dropBacklog} dates={null} />}
      <p className="px-1 py-2 text-(--tracking-dim) text-[11.5px] leading-[17px]">
        {empty ? fr.backlogEmpty : fr.backlogNote}
      </p>
      {footer}
    </section>
  );
}
