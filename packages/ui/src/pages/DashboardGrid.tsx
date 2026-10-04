import type { Instance, Layout } from "@kibo/schema";
import type { CSSProperties, ReactNode } from "react";
import { GAP, ROW_HEIGHT, readingOrder, spanLength } from "../lib/format-grid";

export type DashboardGridProps = {
  instances: Instance[];
  layouts: ReadonlyMap<string, Layout>;
  narrow: boolean;
  renderWidget(instance: Instance, layout: Layout): ReactNode;
  trailing?: ReactNode;
  overlay?: ReactNode;
  focused?: boolean;
};

export const WIDGET_CARD =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card has-[[data-tampered]]:border-destructive";

export const gridArea = (l: Layout): CSSProperties => ({
  gridColumn: `${l.x + 1} / span ${l.w}`,
  gridRow: `${l.y + 1} / span ${l.h}`,
});

const cellStyle = (l: Layout, narrow: boolean): CSSProperties =>
  narrow ? { height: `${spanLength(l.h, ROW_HEIGHT, GAP)}px` } : gridArea(l);

export function DashboardGrid({
  instances,
  layouts,
  narrow,
  renderWidget,
  trailing,
  overlay,
  focused = false,
}: DashboardGridProps) {
  const byId = new Map(instances.map((i) => [i.id, i]));
  const placed = readingOrder(instances.map((i) => ({ ...i, layout: layouts.get(i.id) ?? i.layout })));
  const bottom = Math.max(0, ...placed.map((i) => i.layout.y + i.layout.h));
  return (
    <div
      className={`relative ${focused ? "" : "isolate "}grid flex-1 content-start gap-4 overflow-auto p-4 ${narrow ? "grid-cols-1" : "auto-rows-[80px] grid-cols-12"}`}
    >
      {overlay}
      {placed.map((i) => (
        <div key={i.id} data-instance={i.id} className="min-h-0 min-w-0" style={cellStyle(i.layout, narrow)}>
          {renderWidget(byId.get(i.id) ?? i, i.layout)}
        </div>
      ))}
      {trailing && (
        <div
          className={narrow ? undefined : "col-span-12"}
          style={narrow ? undefined : { gridRow: bottom + 1 }}
        >
          {trailing}
        </div>
      )}
    </div>
  );
}
