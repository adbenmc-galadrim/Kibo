import {
  FrameFooterLine,
  fr,
  frameBorder,
  HeldCount,
  type LaneFrame,
  type LaneStep,
  SEGMENT_BG,
} from "@kibo/component-graph/models";
import { CircleCheck, ClockAlert } from "lucide-react";
import { PhoneStepRow } from "./PhoneStepRow";

type Props = {
  frame: LaneFrame;
  folded: boolean;
  onToggle?(id: string): void;
  onOpen(id: string): void;
  onMenu(step: LaneStep): void;
};

const FRAME = "rounded-[10px] border border-dashed bg-(--tracking-frame)";

function Segments({ frame }: { frame: LaneFrame }) {
  return (
    <div data-slot="frame-segments" className="flex h-[5px] shrink-0 items-center gap-[3px]">
      {frame.segments.map((s) => (
        <span
          key={s.ticketId}
          data-tone={s.tone}
          className={`h-[5px] min-w-0.5 flex-1 rounded-[1px] ${SEGMENT_BG[s.tone]}`}
        />
      ))}
    </div>
  );
}

function FoldedFrame({ frame, onToggle }: { frame: LaneFrame; onToggle(id: string): void }) {
  const slip = frame.footer?.kind === "late" ? frame.footer.slipTo : null;
  return (
    <article
      aria-label={`${frame.shortKey} ${frame.title}`}
      data-key={frame.shortKey}
      data-folded="true"
      data-late={frame.late ? "true" : undefined}
      className={`${FRAME} ${frameBorder(frame.late)}`}
    >
      <button
        type="button"
        aria-expanded={false}
        onClick={() => onToggle(frame.id)}
        className="flex min-h-14 w-full flex-col justify-center gap-2.5 rounded-[10px] px-3 py-3 text-left"
      >
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-(--tracking-dim) text-xs">{frame.shortKey}</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-(--tracking-fg) text-[15px] leading-[18px]">
            {frame.title}
          </span>
          {frame.held > 0 && (
            <span className="font-mono text-xs">
              <HeldCount held={frame.held} />
            </span>
          )}
          {frame.late && (
            <ClockAlert
              size={14}
              absoluteStrokeWidth
              role="img"
              aria-label={fr.sprints.late(slip)}
              className="shrink-0 text-(--tracking-red)"
            />
          )}
        </span>
        <Segments frame={frame} />
      </button>
    </article>
  );
}

export function PhoneFeatureFrame({ frame, folded, onToggle, onOpen, onMenu }: Props) {
  if (folded && onToggle !== undefined) return <FoldedFrame frame={frame} onToggle={onToggle} />;
  return (
    <article
      aria-label={`${frame.shortKey} ${frame.title}`}
      data-key={frame.shortKey}
      data-late={frame.late ? "true" : undefined}
      className={`flex flex-col gap-2 p-3 ${FRAME} ${frameBorder(frame.late)}`}
    >
      <div className="flex h-4 items-center gap-2 font-mono text-xs">
        <span className="text-(--tracking-dim)">{frame.shortKey}</span>
        <span className="ml-auto text-(--tracking-mfg)">{`${frame.done}/${frame.total}`}</span>
        {frame.held > 0 && <HeldCount held={frame.held} />}
        {frame.delivered && (
          <CircleCheck
            size={14}
            absoluteStrokeWidth
            aria-label={fr.sprints.delivered}
            className="shrink-0 text-(--tracking-green)"
          />
        )}
      </div>
      <button
        type="button"
        aria-expanded={onToggle === undefined ? undefined : true}
        onClick={() => (onToggle ?? onOpen)(frame.id)}
        className="min-h-11 text-left font-semibold text-(--tracking-fg) text-[15px] leading-[18px]"
      >
        {frame.title}
      </button>
      <Segments frame={frame} />
      {frame.steps.length > 0 && (
        <ul className="mt-1 flex flex-col gap-2">
          {frame.steps.map((s) => (
            <PhoneStepRow key={s.ticketId} step={s} onOpen={onOpen} onMenu={onMenu} />
          ))}
        </ul>
      )}
      {frame.footer !== null && <FrameFooterLine footer={frame.footer} />}
    </article>
  );
}
