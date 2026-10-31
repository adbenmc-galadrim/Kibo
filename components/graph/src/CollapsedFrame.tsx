import { cn } from "@kibo/sdk/lib/utils";
import { ClockAlert } from "lucide-react";
import { frameBorder, HeldCount, Segments } from "./FeatureFrame";
import { fr } from "./fr";
import { FRAME_PAD } from "./frame-geometry";
import type { LaneFrame } from "./sprint-lanes";

type Props = { frame: LaneFrame; onToggle(id: string): void };

export function CollapsedFrame({ frame, onToggle }: Props) {
  const lateSlip = frame.footer?.kind === "late" ? frame.footer.slipTo : null;
  return (
    <article
      aria-label={`${frame.shortKey} ${frame.title}`}
      data-key={frame.shortKey}
      data-folded="true"
      data-late={frame.late ? "true" : undefined}
      className={cn("absolute rounded-[10px] border bg-(--tracking-bg)", frameBorder(frame.late))}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <button
        type="button"
        title={frame.title}
        aria-expanded={false}
        onClick={() => onToggle(frame.id)}
        className="flex size-full cursor-pointer flex-col gap-[9px] rounded-[10px] px-[9px] pt-[11px] text-left"
      >
        <span className="flex h-4 w-full min-w-0 shrink-0 items-center gap-1.5">
          <span className="shrink-0 font-mono text-(--tracking-dim) text-[11px] leading-[14px]">
            {frame.shortKey}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-(--tracking-fg) text-[12.5px] leading-[15px]">
            {frame.title}
          </span>
          {frame.held > 0 && (
            <span className="font-mono text-[11px] leading-[14px]">
              <HeldCount held={frame.held} />
            </span>
          )}
          {frame.late && (
            <ClockAlert
              size={12}
              absoluteStrokeWidth
              role="img"
              aria-label={fr.sprints.late(lateSlip)}
              className="shrink-0 text-(--tracking-red)"
            />
          )}
        </span>
        <Segments segments={frame.segments} inner={frame.width - 2 * FRAME_PAD} />
      </button>
    </article>
  );
}
