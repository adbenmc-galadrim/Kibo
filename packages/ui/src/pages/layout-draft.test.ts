import { expect, test } from "bun:test";
import type { Layout } from "@kibo/schema";
import { cellMetrics } from "../lib/format-grid";
import {
  compactDraft,
  displayedLayouts,
  editsOf,
  heldPreview,
  previewMove,
  previewSize,
} from "./layout-draft";

const m = cellMetrics(1200);
const draft = (entries: [string, Layout][]) => new Map(entries);

test("previewMove lands the moved widget first and lets the others flow", () => {
  const layouts = draft([
    ["k", { x: 0, y: 0, w: 6, h: 6 }],
    ["t", { x: 6, y: 0, w: 6, h: 3 }],
  ]);
  const preview = previewMove(layouts, "t", { x: -6 * (m.column + m.gap), y: 6 * (m.row + m.gap) }, m);
  expect(preview?.landing).toEqual({ x: 0, y: 6, w: 6, h: 3 });
  expect(preview?.layouts.get("k")).toEqual({ x: 0, y: 0, w: 6, h: 6 });
  const onto = previewMove(layouts, "t", { x: -6 * (m.column + m.gap), y: 0 }, m);
  expect(onto?.landing).toEqual({ x: 0, y: 0, w: 6, h: 3 });
  expect(onto?.layouts.get("k")).toEqual({ x: 0, y: 3, w: 6, h: 6 });
  expect(previewMove(layouts, "zz", { x: 0, y: 0 }, m)).toBeNull();
});

test("previewSize applies a size at the same place, clamps x, and compacts", () => {
  const layouts = draft([
    ["k", { x: 0, y: 0, w: 6, h: 6 }],
    ["t", { x: 6, y: 0, w: 6, h: 3 }],
  ]);
  const half = previewSize(layouts, "k", { w: 12, h: 6 });
  expect(half?.landing).toEqual({ x: 0, y: 0, w: 12, h: 6 });
  expect(half?.layouts.get("t")).toEqual({ x: 6, y: 6, w: 6, h: 3 });
  const wide = previewSize(layouts, "t", { w: 9, h: 3 });
  expect(wide?.landing).toEqual({ x: 3, y: 0, w: 9, h: 3 });
  expect(wide?.layouts.get("k")).toEqual({ x: 0, y: 3, w: 6, h: 6 });
  expect(previewSize(layouts, "zz", { w: 3, h: 3 })).toBeNull();
});

test("compactDraft is compactLayouts over a draft", () => {
  expect(compactDraft(draft([["a", { x: 0, y: 5, w: 3, h: 3 }]])).get("a")).toEqual({
    x: 0,
    y: 0,
    w: 3,
    h: 3,
  });
});

test("displayedLayouts keeps a remote move on a widget the local edits did not touch", () => {
  const saved = draft([
    ["k", { x: 0, y: 0, w: 6, h: 6 }],
    ["t", { x: 0, y: 6, w: 6, h: 3 }],
  ]);
  const shown = displayedLayouts(saved, draft([["k", { x: 0, y: 0, w: 12, h: 6 }]]));
  expect(shown.get("t")).toEqual({ x: 0, y: 6, w: 6, h: 3 });
  expect(displayedLayouts(saved, draft([["gone", { x: 6, y: 0, w: 6, h: 3 }]]))).toBe(saved);
});

test("editsOf keeps only what differs from the saved state, heldPreview keeps the dragged widget in place", () => {
  const saved = draft([
    ["k", { x: 0, y: 0, w: 6, h: 6 }],
    ["t", { x: 6, y: 0, w: 6, h: 3 }],
  ]);
  const preview = previewMove(saved, "t", { x: -6 * (m.column + m.gap), y: 0 }, m);
  if (!preview) throw new Error("no preview");
  expect([...editsOf(saved, preview)]).toEqual([
    ["t", { x: 0, y: 0, w: 6, h: 3 }],
    ["k", { x: 0, y: 3, w: 6, h: 6 }],
  ]);
  expect(heldPreview(preview.layouts, "t", saved).get("t")).toEqual({ x: 6, y: 0, w: 6, h: 3 });
});
