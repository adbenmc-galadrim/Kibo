import type { DeadlineCell, DeadlineColumn, DeadlineRow } from "@kibo/schema";

export type UnplannedColumn = { kind: "unplanned"; label: string };
export type TimelineColumnInput = DeadlineColumn | UnplannedColumn;
export type TimelineInput<C extends TimelineColumnInput = DeadlineColumn> = {
  columns: C[];
  rows: DeadlineRow[];
  today: number | null;
  collapsed?: { label: string; rows: DeadlineRow[] };
};
export type CaseTone = "done" | "review" | "progress" | "blocked" | "todo";
export type TimelineGeometry = {
  label: number;
  column: number;
  pad: number;
  gap: number;
  header: number;
  row: number;
  bottom: number;
};
export type TimelineCase = { x: number; width: number; tone: CaseTone; slipped: boolean };
export type TimelineColumn = {
  x: number;
  start: string | null;
  code: string | null;
  label: string | null;
  current: boolean;
};
export type TimelineRow = {
  row: DeadlineRow;
  y: number;
  cases: TimelineCase[];
  slip: { x: number; code: string } | null;
  blocked: { x: number; ref: string } | null;
};
export type TimelineLayout = {
  width: number;
  height: number;
  columns: TimelineColumn[];
  rows: TimelineRow[];
  todayX: number | null;
};

export const TIMELINE_GEOMETRY: TimelineGeometry = {
  label: 250,
  column: 139,
  pad: 10,
  gap: 3,
  header: 30,
  row: 30,
  bottom: 6,
};
const WEEK_DAYS = 7;
const SLIP_LABEL_GAP = 9;

export function caseWidth(count: number, g: TimelineGeometry = TIMELINE_GEOMETRY): number {
  if (count <= 0) return 0;
  return (g.column - 2 * g.pad - g.gap * (count - 1)) / count;
}

export function caseTone(cell: DeadlineCell): CaseTone {
  if (cell.statusId === "done") return "done";
  if (cell.blocked || cell.statusId === "blocked") return "blocked";
  if (cell.statusId === "in_review") return "review";
  if (cell.statusId === "in_progress") return "progress";
  return "todo";
}

const columnX = (index: number, g: TimelineGeometry): number => g.label + index * g.column;

const sprintOf = (c: TimelineColumnInput) => ("sprint" in c ? c.sprint : null);

function slipColumn(row: DeadlineRow, columns: readonly TimelineColumnInput[]): number | null {
  if (row.slipTo === null) return null;
  const target = row.slipTo.id;
  const index = columns.findIndex((c) => sprintOf(c)?.id === target);
  return index >= 0 ? index : null;
}

function placeCases(cells: readonly DeadlineCell[], left: number, width: number, g: TimelineGeometry) {
  return cells.map((cell, i) => ({
    x: left + i * (width + g.gap),
    width,
    tone: caseTone(cell),
    slipped: cell.slipped,
  }));
}

function rowLayout(
  row: DeadlineRow,
  index: number,
  columns: readonly TimelineColumnInput[],
  g: TimelineGeometry,
): TimelineRow {
  const planned = row.cells.filter((c) => !c.slipped);
  const width = caseWidth(planned.length, g);
  const cases = placeCases(planned, columnX(row.column, g) + g.pad, width, g);
  const target = slipColumn(row, columns);
  const slipped =
    target === null
      ? []
      : placeCases(
          row.cells.filter((c) => c.slipped),
          columnX(target, g) + g.pad,
          width,
          g,
        );
  const last = slipped.at(-1);
  return {
    row,
    y: g.header + index * g.row,
    cases: [...cases, ...slipped],
    slip:
      row.slipTo === null || last === undefined
        ? null
        : { x: last.x + last.width + SLIP_LABEL_GAP, code: row.slipTo.code },
    blocked: row.blockedBy === null ? null : { x: columnX(row.column + 1, g) + g.pad, ref: row.blockedBy },
  };
}

const chipRoom = (rows: readonly TimelineRow[], end: number, g: TimelineGeometry): number =>
  rows.some((r) => r.blocked !== null && r.blocked.x >= end) ? g.column : 0;

export function timelineLayout(
  input: Pick<TimelineInput<TimelineColumnInput>, "columns" | "rows" | "today">,
  g: TimelineGeometry = TIMELINE_GEOMETRY,
): TimelineLayout {
  const span = input.columns.length * g.column;
  const days = input.columns.length * WEEK_DAYS;
  const today = input.today;
  const currentIndex = today === null || today >= 1 ? null : Math.floor(today * input.columns.length);
  const rows = input.rows.map((row, i) => rowLayout(row, i, input.columns, g));
  return {
    width: g.label + span + chipRoom(rows, g.label + span, g),
    height: g.header + input.rows.length * g.row + g.bottom,
    columns: input.columns.map((c, i) => ({
      x: columnX(i, g),
      start: "start" in c ? c.start : null,
      code: sprintOf(c)?.code ?? null,
      label: "label" in c ? c.label : null,
      current: i === currentIndex && "start" in c,
    })),
    rows,
    todayX: today === null || days === 0 ? null : g.label + (today + 1 / (2 * days)) * span,
  };
}
