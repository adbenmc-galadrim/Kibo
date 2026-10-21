import { expect, test } from "bun:test";
import type { DeadlineCell, DeadlineColumn, DeadlineRow, StatusId } from "@kibo/schema";
import { caseTone, caseWidth, stepCaseTone, TIMELINE_GEOMETRY, timelineLayout } from "./timeline-model";

const COLUMNS: DeadlineColumn[] = [
  { start: "2026-10-12", sprint: { id: "s42", code: "S42" } },
  { start: "2026-10-19", sprint: { id: "s43", code: "S43" } },
  { start: "2026-10-26", sprint: { id: "s44", code: "S44" } },
  { start: "2026-11-02", sprint: null },
];
const cell = (statusId: StatusId, extra: Partial<DeadlineCell> = {}): DeadlineCell => ({
  statusId,
  blocked: false,
  slipped: false,
  ...extra,
});
const row = (over: Partial<DeadlineRow> & Pick<DeadlineRow, "featureId" | "cells">): DeadlineRow => ({
  shortKey: over.featureId.toUpperCase(),
  title: over.featureId,
  sprintId: "s42",
  column: 0,
  slipTo: null,
  blockedBy: null,
  ...over,
});
const F4 = row({
  featureId: "f4",
  cells: [cell("done"), cell("done"), cell("done"), cell("in_review"), cell("todo")],
});
const F5 = row({
  featureId: "f5",
  cells: [
    cell("done"),
    cell("in_review"),
    cell("in_progress"),
    cell("todo"),
    cell("todo"),
    ...[0, 1, 2, 3].map(() => cell("todo", { slipped: true })),
  ],
  slipTo: { id: "s43", code: "S43" },
});
const F6 = row({
  featureId: "f6",
  sprintId: "s43",
  column: 1,
  cells: [cell("todo", { blocked: true }), cell("todo"), cell("todo"), cell("todo")],
  blockedBy: "Q14",
});
const layout = () => timelineLayout({ columns: COLUMNS, rows: [F4, F5, F6], today: 4 / 28 });

test("case widths share the inner width of a column between the steps of a feature", () => {
  expect(caseWidth(5)).toBeCloseTo(21.4, 5);
  expect(caseWidth(4)).toBeCloseTo(27.5, 5);
  expect(caseWidth(0)).toBe(0);
});

test("a cell reads as delivered, review, in progress, blocked or to do", () => {
  expect(caseTone(cell("done"))).toBe("done");
  expect(caseTone(cell("in_review"))).toBe("review");
  expect(caseTone(cell("in_progress"))).toBe("progress");
  expect(caseTone(cell("todo", { blocked: true }))).toBe("blocked");
  expect(caseTone(cell("blocked"))).toBe("blocked");
  expect(caseTone(cell("backlog"))).toBe("todo");
});

test("columns follow the label column, one week each, the week of today is current", () => {
  const l = layout();
  expect(l.width).toBe(806);
  expect(l.height).toBe(30 + 3 * 30 + 6);
  expect(l.columns.map((c) => [c.x, c.code, c.start, c.current])).toEqual([
    [250, "S42", "2026-10-12", true],
    [389, "S43", "2026-10-19", false],
    [528, "S44", "2026-10-26", false],
    [667, null, "2026-11-02", false],
  ]);
});

test("today is drawn in the middle of its day", () => {
  expect(layout().todayX).toBeCloseTo(339.36, 2);
  expect(timelineLayout({ columns: COLUMNS, rows: [], today: null }).todayX).toBeNull();
  expect(timelineLayout({ columns: COLUMNS, rows: [], today: null }).columns.some((c) => c.current)).toBe(
    false,
  );
});

test("cases sit in the column of their sprint, one row every 30 px", () => {
  const [f4] = layout().rows;
  expect(f4?.y).toBe(30);
  expect(f4?.cases.map((c) => [Number(c.x.toFixed(1)), c.tone, c.slipped])).toEqual([
    [260, "done", false],
    [284.4, "done", false],
    [308.8, "done", false],
    [333.2, "review", false],
    [357.6, "todo", false],
  ]);
});

test("the slip of a late feature is drawn in the next sprint, with its label after the cases", () => {
  const f5 = layout().rows[1];
  const slipped = f5?.cases.filter((c) => c.slipped) ?? [];
  expect(slipped.map((c) => Number(c.x.toFixed(1)))).toEqual([399, 423.4, 447.8, 472.2]);
  expect(slipped.every((c) => Math.abs(c.width - 21.4) < 1e-6)).toBe(true);
  expect(f5?.slip?.code).toBe("S43");
  expect(f5?.slip?.x).toBeCloseTo(502.6, 5);
  expect(f5?.y).toBe(60);
});

test("a blocked feature carries its question in the next column", () => {
  const f6 = layout().rows[2];
  expect(f6?.cases[0]?.tone).toBe("blocked");
  expect(f6?.cases[0]?.x).toBe(399);
  expect(f6?.cases[0]?.width).toBeCloseTo(27.5, 5);
  expect(f6?.blocked).toEqual({ x: 538, ref: "Q14" });
});

test("a blocked feature of the last column widens the grid by one column for its chip", () => {
  const last = row({ ...F6, column: 3, sprintId: "backlog" });
  const g = TIMELINE_GEOMETRY;
  const span = g.label + COLUMNS.length * g.column;
  expect(timelineLayout({ columns: COLUMNS, rows: [last], today: null }).width).toBe(span + g.column);
  expect(timelineLayout({ columns: COLUMNS, rows: [F6], today: null }).width).toBe(span);
});

test("a slip whose sprint is outside the window is not drawn", () => {
  const late = row({ ...F5, column: 3, sprintId: "s45", slipTo: { id: "s46", code: "S46" } });
  const drawn = timelineLayout({ columns: COLUMNS, rows: [late], today: null }).rows[0];
  expect(drawn?.cases.some((c) => c.slipped)).toBe(false);
  expect(drawn?.slip).toBeNull();
});

test("the geometry of the deadlines card is the default", () => {
  expect(TIMELINE_GEOMETRY).toEqual({
    label: 250,
    column: 139,
    pad: 10,
    gap: 3,
    header: 30,
    row: 30,
    bottom: 6,
  });
});

test("an unplanned column has a label, no date, and never holds today", () => {
  const unplanned = { kind: "unplanned", label: "À planifier" } as const;
  const built = timelineLayout({ columns: [...COLUMNS, unplanned], rows: [], today: 0.99 });
  expect(built.columns.at(-1)).toEqual({
    x: TIMELINE_GEOMETRY.label + COLUMNS.length * TIMELINE_GEOMETRY.column,
    start: null,
    code: null,
    label: "À planifier",
    current: false,
  });
  expect(built.columns[0]?.label).toBeNull();
});

test("a step on hold is « hold » before any status, a blocked one stays « blocked »", () => {
  const held = { source: "own", key: "SILO-33", reason: "Serveur MinIO", since: "2026-10-16" } as const;
  expect(stepCaseTone({ statusId: "in_progress", onHold: held }, false)).toBe("hold");
  expect(stepCaseTone({ statusId: "blocked", onHold: held }, false)).toBe("hold");
  expect(stepCaseTone({ statusId: "todo", onHold: { ...held, source: "dependency" } }, true)).toBe("hold");
  expect(stepCaseTone({ statusId: "done", onHold: held }, false)).toBe("hold");
  expect(stepCaseTone({ statusId: "todo", onHold: null }, true)).toBe("blocked");
  expect(stepCaseTone({ statusId: "in_review", onHold: null }, false)).toBe("review");
  expect(stepCaseTone({ statusId: "backlog", onHold: null }, false)).toBe("todo");
});
