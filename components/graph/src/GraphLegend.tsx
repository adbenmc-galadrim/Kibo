import { type LegendEntry, LegendToggle } from "@kibo/sdk/tracking";

export type LegendItem = LegendEntry;

export function GraphLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <LegendToggle
      items={items}
      className="pointer-events-none absolute bottom-[18px] left-4 h-[30px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[8px] border border-(--tracking-border) bg-(--tracking-card) pr-1.5 pl-1.5 has-[ul]:pr-3"
    />
  );
}
