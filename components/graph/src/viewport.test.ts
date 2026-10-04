import { expect, test } from "bun:test";
import { clampZoom, fitAll, fitNode, panBy, wheelAction, zoomAt } from "./viewport";

test("zoomAt keeps the focused point still and clamps between 0.25 and 3", () => {
  const v = { zoom: 1, pan: { x: 0, y: 0 } };
  const zoomed = zoomAt(v, 2, { x: 100, y: 50 });
  expect(zoomed.zoom).toBe(2);
  expect(zoomed.pan).toEqual({ x: -100, y: -50 });
  expect(zoomAt(v, 10, { x: 0, y: 0 }).zoom).toBe(3);
  expect(zoomAt(v, 0.01, { x: 0, y: 0 }).zoom).toBe(0.25);
  expect(clampZoom(1.234)).toBe(1.23);
});

test("fitAll centers the content at the largest zoom that fits, never above 1, and survives an empty box", () => {
  const fit = fitAll({ width: 1000, height: 500 }, { width: 548, height: 298 }, 24);
  expect(fit.zoom).toBe(0.5);
  expect(fit.pan).toEqual({ x: 24, y: 24 });
  expect(fitAll({ width: 100, height: 100 }, { width: 1000, height: 1000 }).zoom).toBe(1);
  expect(fitAll({ width: 1000, height: 500 }, { width: 0, height: 0 })).toEqual({
    zoom: 1,
    pan: { x: 24, y: 24 },
  });
  expect(fitAll({ width: 0, height: 0 }, { width: 800, height: 600 })).toEqual({
    zoom: 1,
    pan: { x: 24, y: 24 },
  });
});

test("fitNode centers a node at 1.25 and panBy adds", () => {
  const v = fitNode({ x: 100, y: 200 }, { width: 176, height: 52 }, { width: 800, height: 600 });
  expect(v.zoom).toBe(1.25);
  expect(v.pan).toEqual({ x: 400 - 188 * 1.25, y: 300 - 226 * 1.25 });
  expect(panBy({ zoom: 1, pan: { x: 1, y: 2 } }, 3, 4)).toEqual({ zoom: 1, pan: { x: 4, y: 6 } });
});

test("a wheel with ctrl or meta zooms, otherwise it pans against the delta", () => {
  expect(wheelAction({ deltaX: 0, deltaY: -100, ctrlKey: true, metaKey: false })).toEqual({
    kind: "zoom",
    factor: Math.exp(1),
  });
  expect(wheelAction({ deltaX: 0, deltaY: 50, ctrlKey: false, metaKey: true })).toEqual({
    kind: "zoom",
    factor: Math.exp(-0.5),
  });
  expect(wheelAction({ deltaX: 30, deltaY: 20, ctrlKey: false, metaKey: false })).toEqual({
    kind: "pan",
    dx: -30,
    dy: -20,
  });
});
