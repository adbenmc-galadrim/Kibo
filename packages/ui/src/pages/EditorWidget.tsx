import { useDraggable } from "@dnd-kit/core";
import type { ComponentFormat, Instance } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { frLayout } from "../i18n/fr-layout";
import { componentIcon } from "../registry";
import { WIDGET_CARD } from "./DashboardGrid";
import { FormatMenu } from "./FormatMenu";

export type EditorWidgetProps = {
  instance: Instance;
  title: string;
  current: ComponentFormat;
  formats: readonly ComponentFormat[];
  fits(format: ComponentFormat): boolean;
  onFormat(format: ComponentFormat): void;
  onRemove(): void;
  children: ReactNode;
};

export function EditorWidget({
  instance,
  title,
  current,
  formats,
  fits,
  onFormat,
  onRemove,
  children,
}: EditorWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: instance.id,
    attributes: { roleDescription: "widget déplaçable" },
  });
  const Icon = componentIcon(instance.component);
  return (
    <div
      ref={setNodeRef}
      className={cn(WIDGET_CARD, isDragging && "relative z-20 opacity-90 shadow-lg ring-2 ring-ring")}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b px-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={frLayout.move(title)}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-xs font-medium">{title}</span>
        </button>
        <FormatMenu title={title} current={current} formats={formats} fits={fits} onPick={onFormat} />
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          aria-label={frLayout.remove(title)}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="pointer-events-none flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
