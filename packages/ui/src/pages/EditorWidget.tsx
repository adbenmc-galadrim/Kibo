import { useDraggable } from "@dnd-kit/core";
import type { ComponentFormat, Instance, Layout } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { frLayout } from "../i18n/fr-layout";
import { componentIcon } from "../registry";
import { WIDGET_CARD } from "./DashboardGrid";
import { FormatMenu } from "./FormatMenu";
import type { ArrowKey, ResizeEdge } from "./layout-resize";
import { type Pointer, ResizeHandles } from "./ResizeHandles";

export type EditorWidgetProps = {
  instance: Instance;
  title: string;
  layout: Layout;
  sizing: Layout | null;
  current: ComponentFormat;
  formats: readonly ComponentFormat[];
  onFormat(format: ComponentFormat): void;
  onRemove(): void;
  onResizeStart(edge: ResizeEdge, pointer: Pointer): void;
  onResize(pointer: Pointer): void;
  onResizeEnd(): void;
  onKeyResize(key: ArrowKey): void;
  children: ReactNode;
};

export function EditorWidget({
  instance,
  title,
  layout,
  sizing,
  current,
  formats,
  onFormat,
  onRemove,
  onResizeStart,
  onResize,
  onResizeEnd,
  onKeyResize,
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
      className={cn(
        WIDGET_CARD,
        "relative",
        isDragging && "z-20 opacity-90 shadow-lg ring-2 ring-ring",
        sizing && "z-20 ring-2 ring-ring",
      )}
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
        <span
          className={cn(
            "shrink-0 font-mono text-2xs text-muted-foreground tabular-nums",
            sizing && "text-foreground",
          )}
        >
          {frLayout.sizeLabel(layout.w, layout.h)}
        </span>
        <FormatMenu title={title} current={current} formats={formats} onPick={onFormat} />
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
      {sizing && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-10 bottom-0 z-10 flex items-center justify-center bg-background/60"
        >
          <span className="rounded-md border bg-popover px-2.5 py-1 font-mono text-sm text-popover-foreground shadow-sm tabular-nums">
            {frLayout.cells(sizing.w, sizing.h)}
          </span>
        </div>
      )}
      <ResizeHandles
        title={title}
        onStart={onResizeStart}
        onMove={onResize}
        onEnd={onResizeEnd}
        onKey={onKeyResize}
      />
    </div>
  );
}
