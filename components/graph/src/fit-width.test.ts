import { expect, test } from "bun:test";
import { COLUMN_MIN_W, FOLDED_FRAME_H, fitColumnWidth, foldLanes } from "./fit-width";
import { sprintLanes } from "./sprint-lanes";
import { kitInput } from "./sprint-lanes-kit";

const model = () => sprintLanes(kitInput());
const frames = (m = model()) => m.lanes.flatMap((l) => l.frames);

test("column width makes n sprints fit the container, minimum 160", () => {
  expect(fitColumnWidth(4, 1200)).toBe(300);
  expect(fitColumnWidth(7, 1200)).toBe(171);
  expect(fitColumnWidth(9, 1199)).toBe(COLUMN_MIN_W);
  expect(COLUMN_MIN_W).toBe(160);
});

test("every frame folds to 56 px and the stacks close up, 30 px apart", () => {
  const folded = foldLanes(model(), new Set(), 1199);
  for (const frame of frames(folded)) {
    expect(frame.folded).toBe(true);
    expect(frame.height).toBe(FOLDED_FRAME_H);
  }
  const s42 = folded.lanes[1]?.frames ?? [];
  expect(s42.map((f) => f.y)).toEqual([70, 156, 242]);
  expect(FOLDED_FRAME_H).toBe(56);
});

test("the natural widths stay when the columns already fit", () => {
  const natural = model();
  const folded = foldLanes(natural, new Set(), natural.width);
  expect(folded.lanes.map((l) => [l.x, l.width])).toEqual(natural.lanes.map((l) => [l.x, l.width]));
  expect(frames(folded).map((f) => [f.x, f.width])).toEqual(frames(natural).map((f) => [f.x, f.width]));
});

test("an unmeasured container keeps the natural widths", () => {
  const natural = model();
  expect(foldLanes(natural, new Set(), 0).width).toBe(natural.width);
});

test("columns too wide for the container share it evenly and no frame overflows its column", () => {
  const natural = model();
  const available = natural.width - 200;
  const folded = foldLanes(natural, new Set(), available);
  const column = fitColumnWidth(natural.lanes.length, available);
  expect(folded.width).toBe(column * natural.lanes.length);
  for (const lane of folded.lanes) {
    expect(lane.width).toBe(column);
    for (const frame of lane.frames) {
      expect(frame.x).toBeGreaterThanOrEqual(lane.x);
      expect(frame.x + frame.width).toBeLessThanOrEqual(lane.x + lane.width);
    }
  }
});

test("an unfolded frame gets its natural height back and pushes the next one down", () => {
  const natural = model();
  const s42 = natural.lanes[1]?.frames ?? [];
  const target = s42[1];
  if (target === undefined) throw new Error("missing frame");
  const folded = foldLanes(natural, new Set([target.id]), natural.width);
  const placed = folded.lanes[1]?.frames ?? [];
  expect(placed[1]?.folded).toBe(false);
  expect(placed[1]?.height).toBe(target.height);
  expect(placed[2]?.y).toBe((placed[1]?.y ?? 0) + target.height + 30);
  expect(folded.height).toBeLessThan(natural.height);
});
