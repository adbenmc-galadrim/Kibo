import { cn } from "@kibo/sdk/lib/utils";
import { CircleCheck, ClockAlert, Lock, Pause } from "lucide-react";
import { FrameStepRow } from "./FrameStepRow";
import { fr } from "./fr";
import { FRAME_PAD, type TitleLines } from "./frame-geometry";
import type { FrameFooter, FrameSegment, LaneFrame, StepTone } from "./sprint-lanes";

const SEGMENT_GAP = 3;
const DASH = "11 11";

const TITLE_CLAMP: Record<TitleLines, string> = { 1: "truncate", 2: "line-clamp-2", 3: "line-clamp-3" };

const SEGMENT_BG: Record<StepTone, string> = {
  done: "bg-(--tracking-fg)",
  review: "bg-(--tracking-purple)",
  progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
  hold: "bg-(--tracking-hold)",
  todo: "bg-(--tracking-border)",
};

function DashedOutline({
  width,
  height,
  radius,
  color,
}: {
  width: number;
  height: number;
  radius: number;
  color: string;
}) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={width} height={height}>
      <rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        rx={radius - 0.5}
        fill="none"
        stroke={color}
        strokeDasharray={DASH}
      />
    </svg>
  );
}

function Segments({ segments, inner }: { segments: readonly FrameSegment[]; inner: number }) {
  const count = Math.max(1, segments.length);
  const width = Math.max(2, Math.floor((inner - SEGMENT_GAP * (count - 1)) / count));
  return (
    <div data-slot="frame-segments" className="flex h-[5px] shrink-0 items-center gap-[3px]">
      {segments.map((s) => (
        <span
          key={s.ticketId}
          data-tone={s.tone}
          className={cn("h-[5px] shrink-0 rounded-[1px]", SEGMENT_BG[s.tone])}
          style={{ width }}
        />
      ))}
    </div>
  );
}

function Footer({ footer }: { footer: FrameFooter }) {
  const Icon = footer.kind === "blocked" ? Lock : ClockAlert;
  const text =
    footer.kind === "blocked" ? fr.sprints.blockedBy(footer.question) : fr.sprints.late(footer.slipTo);
  return (
    <p className="flex h-[14px] shrink-0 items-center gap-[5px] text-(--tracking-red) text-[11px] leading-[14px]">
      <Icon size={12} absoluteStrokeWidth aria-hidden className="shrink-0" />
      {text}
    </p>
  );
}

function HeldCount({ held }: { held: number }) {
  return (
    <span
      role="img"
      aria-label={fr.sprints.held(held)}
      className="flex shrink-0 items-center gap-0.5 text-(--tracking-hold)"
    >
      <Pause size={11} absoluteStrokeWidth aria-hidden className="shrink-0" />
      {held}
    </span>
  );
}

type Props = { frame: LaneFrame; onOpen(id: string): void };

export function FeatureFrame({ frame, onOpen }: Props) {
  return (
    <article
      aria-label={`${frame.shortKey} ${frame.title}`}
      data-key={frame.shortKey}
      data-late={frame.late ? "true" : undefined}
      data-title-lines={frame.titleLines}
      className="absolute flex flex-col gap-1.5 rounded-[10px] bg-(--tracking-bg) p-2.5"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <DashedOutline
        width={frame.width}
        height={frame.height}
        radius={10}
        color={frame.late ? "var(--tracking-red)" : "var(--tracking-mfg)"}
      />
      <div className="flex h-[14px] shrink-0 items-center gap-1.5 font-mono text-[11px] leading-[14px]">
        <span className="text-(--tracking-dim)">{frame.shortKey}</span>
        <span className="ml-auto text-(--tracking-mfg)">{`${frame.done}/${frame.total}`}</span>
        {frame.held > 0 && <HeldCount held={frame.held} />}
        {frame.delivered && (
          <CircleCheck
            size={12}
            absoluteStrokeWidth
            aria-label={fr.sprints.delivered}
            className="shrink-0 text-(--tracking-green)"
          />
        )}
      </div>
      <button
        type="button"
        title={frame.title}
        onClick={() => onOpen(frame.id)}
        className="shrink-0 cursor-pointer text-left font-semibold text-(--tracking-fg) text-[12.5px] leading-[15px]"
      >
        <span className={cn("block", TITLE_CLAMP[frame.titleLines])}>{frame.title}</span>
      </button>
      <Segments segments={frame.segments} inner={frame.width - 2 * FRAME_PAD} />
      {frame.steps.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {frame.steps.map((s) => (
            <FrameStepRow key={s.ticketId} step={s} onOpen={onOpen} />
          ))}
        </ul>
      )}
      {frame.footer !== null && <Footer footer={frame.footer} />}
    </article>
  );
}
