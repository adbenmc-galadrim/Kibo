import { FIRST_FRAME_Y, frameHeight, LANE_MARGIN, STACK_GAP, titleLines } from "./frame-geometry";
import type { Lane, LaneFrame, SprintLanesModel } from "./sprint-lanes";

export const COLUMN_MIN_W = 160;
export const FOLDED_FRAME_H = 56;

export const fitColumnWidth = (columns: number, available: number): number =>
  Math.max(COLUMN_MIN_W, Math.floor(available / columns));

type FramePlace = { x: number; width: number };

function stackFrames(
  frames: readonly LaneFrame[],
  place: (frame: LaneFrame) => FramePlace,
  unfolded: ReadonlySet<string>,
): LaneFrame[] {
  let y = FIRST_FRAME_Y;
  return frames.map((frame) => {
    const { x, width } = place(frame);
    const lines = titleLines(frame.title, width);
    const folded = !unfolded.has(frame.id);
    const height = folded
      ? FOLDED_FRAME_H
      : frameHeight({ lines, steps: frame.steps.length, footer: frame.footer !== null });
    const placed = { ...frame, folded, titleLines: lines, x, y, width, height };
    y += height + STACK_GAP;
    return placed;
  });
}

function fitLane(lane: Lane, x: number, column: number | null, unfolded: ReadonlySet<string>): Lane {
  const width = column ?? lane.width;
  const place = (frame: LaneFrame): FramePlace =>
    column === null
      ? { x: frame.x, width: frame.width }
      : { x: x + LANE_MARGIN, width: column - 2 * LANE_MARGIN };
  return { ...lane, x, width, frames: stackFrames(lane.frames, place, unfolded) };
}

export function foldLanes(
  model: SprintLanesModel,
  unfolded: ReadonlySet<string>,
  available: number,
): SprintLanesModel {
  const overflows = available > 0 && model.width > available;
  const column = overflows ? fitColumnWidth(model.lanes.length, available) : null;
  const lanes: Lane[] = [];
  let x = 0;
  for (const lane of model.lanes) {
    const fitted = fitLane(lane, x, column, unfolded);
    lanes.push(fitted);
    x += fitted.width;
  }
  const bottoms = lanes.flatMap((l) => l.frames).map((f) => f.y + f.height);
  return { ...model, lanes, width: x, height: Math.max(0, ...bottoms) + FIRST_FRAME_Y };
}
