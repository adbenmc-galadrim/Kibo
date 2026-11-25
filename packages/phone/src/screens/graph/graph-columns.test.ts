import { expect, test } from "bun:test";
import type { Lane } from "@kibo/component-graph/models";
import { COLUMN_WIDTH, startLane, visibleLanes } from "./graph-columns";

const lane = (id: string, state: Lane["state"]): Lane => ({
  id,
  code: id === "reserve" ? null : id,
  name: null,
  state,
  label: null,
  tone: "canvas",
  x: 0,
  width: 0,
  frames: [],
});

const LANES = [lane("S41", "done"), lane("S42", "current"), lane("S43", "planned"), lane("reserve", null)];

test("a column is 86 % of a 390 px screen and the next one peeks by 24 px", () => {
  expect(COLUMN_WIDTH).toBe("calc(100% - 24px)");
  const content = 390 - 2 * 16;
  const width = content - 24;
  const next = 16 + width + 16;
  expect(width).toBe(334);
  expect(Math.round((width / 390) * 100)).toBe(86);
  expect(390 - next).toBe(24);
});

test("the current sprint is the first column in view, else the next planned one, else the latest sprint", () => {
  expect(startLane(LANES)).toBe("S42");
  expect(startLane([lane("S41", "done"), lane("S43", "planned"), lane("reserve", null)])).toBe("S43");
  expect(startLane([lane("S41", "done"), lane("S42", "done"), lane("reserve", null)])).toBe("S42");
  expect(startLane([lane("reserve", null)])).toBe("reserve");
  expect(startLane([])).toBeNull();
});

test("the sprint filter keeps every column or only the chosen one", () => {
  expect(visibleLanes(LANES, null).map((l) => l.id)).toEqual(["S41", "S42", "S43", "reserve"]);
  expect(visibleLanes(LANES, "reserve").map((l) => l.id)).toEqual(["reserve"]);
  expect(visibleLanes(LANES, "S99").map((l) => l.id)).toEqual(["S41", "S42", "S43", "reserve"]);
});
