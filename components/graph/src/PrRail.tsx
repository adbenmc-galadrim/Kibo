import { GitBranch } from "lucide-react";
import { frPrs } from "./fr-prs";
import { type PrsLayout, RAIL_LINE } from "./prs-layout";

const RAIL_LEFT = 150;
const RAIL_RIGHT = 16;
const PILL_H = 20;

export function PrRail({ layout, rail }: { layout: PrsLayout; rail: string | null }) {
  const lineY = layout.railY + RAIL_LINE;
  return (
    <>
      <div
        aria-hidden
        className="absolute h-0.5 bg-(--tracking-border)"
        style={{ left: RAIL_LEFT, top: lineY - 1, width: layout.width - RAIL_LEFT - RAIL_RIGHT }}
      />
      {layout.columns.map((c) => (
        <span
          key={c.stack.root.id}
          aria-hidden
          className="absolute size-2 rounded-full bg-(--tracking-mfg)"
          style={{ left: c.center - 4, top: layout.railY }}
        />
      ))}
      {rail !== null && (
        <p
          className="absolute left-4 flex items-center gap-1.5 rounded-[11px] border border-(--tracking-border) bg-(--tracking-muted) px-2 text-[11.5px] leading-[14px]"
          style={{ top: lineY - PILL_H / 2 - 1, height: PILL_H }}
        >
          <GitBranch size={12} absoluteStrokeWidth aria-hidden className="shrink-0 text-(--tracking-fg)" />
          <span className="font-medium font-mono text-(--tracking-fg)">{rail}</span>
          <span className="text-(--tracking-mfg)">{frPrs.rail}</span>
        </p>
      )}
    </>
  );
}
