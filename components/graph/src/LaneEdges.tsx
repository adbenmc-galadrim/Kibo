import { useId } from "react";
import { TITLE_ANCHOR_Y } from "./frame-geometry";
import type { LaneEdge, LaneFrame, SprintLanesModel } from "./sprint-lanes";

const DETOUR = 16;

type Box = Pick<LaneFrame, "x" | "y" | "width">;

export function edgePath(a: Box, b: Box): string {
  const y1 = a.y + TITLE_ANCHOR_Y;
  const y2 = b.y + TITLE_ANCHOR_Y;
  if (a.x === b.x) return `M${a.x} ${y1} C${a.x - DETOUR} ${y1} ${b.x - DETOUR} ${y2} ${b.x} ${y2}`;
  const x1 = a.x + a.width;
  const mid = (x1 + b.x) / 2;
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${b.x} ${y2}`;
}

export function LaneEdges({ model }: { model: SprintLanesModel }) {
  const arrow = useId();
  const frames = new Map(model.lanes.flatMap((l) => l.frames).map((f) => [f.id, f]));
  const draw = (e: LaneEdge) => {
    const a = frames.get(e.from);
    const b = frames.get(e.to);
    if (a === undefined || b === undefined) return null;
    return (
      <path
        key={`${e.from}-${e.to}`}
        data-edge={`${a.shortKey}>${b.shortKey}`}
        d={edgePath(a, b)}
        fill="none"
        stroke="var(--tracking-mfg)"
        strokeWidth={1.25}
        markerEnd={`url(#${arrow})`}
      />
    );
  };
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={model.width}
      height={model.height}
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M1 1 L9 5 L1 9" fill="none" stroke="var(--tracking-mfg)" strokeWidth={1.25} />
        </marker>
      </defs>
      {model.edges.map(draw)}
    </svg>
  );
}
