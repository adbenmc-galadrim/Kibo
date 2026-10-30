import { stepTitle } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { CARD_CLASS, CARD_TITLE_CLASS, type CardFacts, KanbanCardContent } from "./KanbanCardContent";

type Props = CardFacts & { refused?: boolean };

export function KanbanCardPreview(props: Props) {
  const { ticket: t, refused = false } = props;
  const menu = (
    <span className="inline-flex size-6 items-center justify-center">
      <MoreHorizontal absoluteStrokeWidth size={14} className="size-3.5" />
    </span>
  );
  return (
    <div
      aria-hidden="true"
      data-slot="kanban-drag-preview"
      className={cn(
        CARD_CLASS,
        "h-full shadow-lg ring-1",
        refused ? "cursor-not-allowed ring-destructive/60" : "cursor-grabbing ring-ring",
        t.key === null && "border-dashed",
      )}
    >
      <KanbanCardContent
        {...props}
        menu={menu}
        title={<span className={CARD_TITLE_CLASS}>{stepTitle(t, props.group)}</span>}
      />
    </div>
  );
}
