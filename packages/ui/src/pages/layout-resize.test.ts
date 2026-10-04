import { expect, test } from "bun:test";
import { DEFAULT_SIZE_LIMITS } from "@kibo/schema";
import { cellMetrics } from "../lib/format-grid";
import { keyboardResize, resizeTarget } from "./layout-resize";

const m = cellMetrics(1200);
const step = { x: m.column + m.gap, y: m.row + m.gap };
const kanban = { min: { w: 6, h: 4 }, max: { w: 12, h: 12 } };

test("the corner handle snaps both sizes to cells, the edges one each", () => {
  const l = { x: 0, y: 0, w: 6, h: 6 };
  expect(resizeTarget(l, "corner", { x: step.x * 2.4, y: step.y * 0.6 }, m, DEFAULT_SIZE_LIMITS)).toEqual({
    x: 0,
    y: 0,
    w: 8,
    h: 7,
  });
  expect(resizeTarget(l, "right", { x: step.x, y: step.y * 3 }, m, DEFAULT_SIZE_LIMITS)).toEqual({
    x: 0,
    y: 0,
    w: 7,
    h: 6,
  });
  expect(resizeTarget(l, "bottom", { x: step.x * 3, y: -step.y }, m, DEFAULT_SIZE_LIMITS)).toEqual({
    x: 0,
    y: 0,
    w: 6,
    h: 5,
  });
});

test("the handle stops at the manifest limits and at the grid edge", () => {
  const l = { x: 6, y: 0, w: 6, h: 6 };
  expect(resizeTarget(l, "right", { x: step.x * 3, y: 0 }, m, kanban)).toEqual({ x: 6, y: 0, w: 6, h: 6 });
  expect(resizeTarget(l, "corner", { x: -step.x * 3, y: -step.y * 5 }, m, kanban)).toEqual({
    x: 6,
    y: 0,
    w: 6,
    h: 4,
  });
  expect(resizeTarget({ x: 0, y: 0, w: 6, h: 6 }, "bottom", { x: 0, y: step.y * 20 }, m, kanban)).toEqual({
    x: 0,
    y: 0,
    w: 6,
    h: 12,
  });
});

test("Shift + arrows change one cell at a time within the limits", () => {
  const l = { x: 0, y: 0, w: 6, h: 6 };
  expect(keyboardResize(l, "ArrowRight", kanban)).toEqual({ ...l, w: 7 });
  expect(keyboardResize(l, "ArrowDown", kanban)).toEqual({ ...l, h: 7 });
  expect(keyboardResize(l, "ArrowLeft", kanban)).toEqual(l);
  expect(keyboardResize({ ...l, h: 4 }, "ArrowUp", kanban)).toEqual({ ...l, h: 4 });
  expect(keyboardResize({ x: 6, y: 0, w: 6, h: 6 }, "ArrowRight", kanban)).toEqual({
    x: 6,
    y: 0,
    w: 6,
    h: 6,
  });
});
