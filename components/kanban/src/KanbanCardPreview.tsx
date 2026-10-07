import { cn } from "@kibo/sdk/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { CARD_CLASS, type CardFacts, KanbanCardContent } from "./KanbanCardContent";

type Props = CardFacts & { readOnly: boolean };

export function KanbanCardPreview(props: Props) {
  const { ticket: t, readOnly } = props;
  const menu = !readOnly && (
    <span className="inline-flex size-6 items-center justify-center">
      <MoreHorizontal className="size-3.5" />
    </span>
  );
  return (
    <div
      aria-hidden="true"
      data-slot="kanban-drag-preview"
      className={cn(
        CARD_CLASS,
        "h-full cursor-grabbing shadow-lg ring-1 ring-ring",
        t.key === null && "border-dashed",
      )}
    >
      <KanbanCardContent {...props} menu={menu} title={<span className="w-fit">{t.title}</span>} />
    </div>
  );
}
