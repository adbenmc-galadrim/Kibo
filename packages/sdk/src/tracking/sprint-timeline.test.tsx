import { afterEach, expect, test } from "bun:test";
import type { DeadlineCell, DeadlineColumn, DeadlineRow } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SprintTimeline } from "./SprintTimeline";

afterEach(cleanup);

const COLUMNS: DeadlineColumn[] = [
  { start: "2026-10-12", sprint: { id: "s42", code: "S42" } },
  { start: "2026-10-19", sprint: { id: "s43", code: "S43" } },
  { start: "2026-10-26", sprint: null },
];
const todo: DeadlineCell = { statusId: "todo", blocked: false, slipped: false };
const row = (featureId: string, extra: Partial<DeadlineRow> = {}): DeadlineRow => ({
  featureId,
  shortKey: featureId.toUpperCase(),
  title: `Titre ${featureId}`,
  sprintId: "s42",
  cells: [todo, todo],
  column: 0,
  slipTo: null,
  blockedBy: null,
  ...extra,
});

test("the timeline shows the week headers, the rows, today, the slip and the legend", () => {
  const late = row("f5", {
    cells: [todo, { ...todo, slipped: true }],
    slipTo: { id: "s43", code: "S43" },
  });
  const blocked = row("f6", { blockedBy: "Q14", cells: [{ ...todo, blocked: true }] });
  const { container } = render(
    <SprintTimeline columns={COLUMNS} rows={[late, blocked]} today={4 / 21} legend />,
  );
  expect(screen.getByText("S42")).toBeTruthy();
  expect(screen.getByText("12 oct.")).toBeTruthy();
  expect(screen.getByText("26 oct.")).toBeTruthy();
  expect(screen.getByText("glisse en S43")).toBeTruthy();
  expect(screen.getByText("bloquée · Q14")).toBeTruthy();
  expect(screen.getByText("aujourd'hui")).toBeTruthy();
  expect(screen.getByText("glissement prévu")).toBeTruthy();
  expect(container.querySelectorAll('[data-tone="slipped"]').length).toBe(1);
  expect(container.querySelectorAll('[data-tone="blocked"]').length).toBe(1);
  expect(container.querySelector("[data-current]")?.textContent).toContain("S42");
});

test("the blocked chip and the slip label stay on one line", () => {
  const late = row("f5", { cells: [todo, { ...todo, slipped: true }], slipTo: { id: "s43", code: "S43" } });
  const blocked = row("f6", { blockedBy: "Q14", column: 2 });
  render(<SprintTimeline columns={COLUMNS} rows={[late, blocked]} today={null} />);
  expect(screen.getByText("bloquée · Q14").className).toContain("whitespace-nowrap");
  expect(screen.getByText("glisse en S43").className).toContain("whitespace-nowrap");
});

test("a feature opens on a click on its label", async () => {
  const opened: string[] = [];
  render(
    <SprintTimeline columns={COLUMNS} rows={[row("f4")]} today={null} onOpen={(id) => opened.push(id)} />,
  );
  await userEvent.click(screen.getByRole("button", { name: /F4/ }));
  expect(opened).toEqual(["f4"]);
  expect(screen.queryByText("aujourd'hui")).toBeNull();
});

test("collapsed rows unfold under their label", async () => {
  render(
    <SprintTimeline
      columns={COLUMNS}
      rows={[row("f4")]}
      today={null}
      collapsed={{ label: "Livrées · 1", rows: [row("f1")] }}
    />,
  );
  expect(screen.queryByText("Titre f1")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Livrées · 1" }));
  expect(screen.getByText("Titre f1")).toBeTruthy();
});

test("an unplanned column shows its label in the text font, without a date", () => {
  const { container } = render(
    <SprintTimeline
      columns={[...COLUMNS, { kind: "unplanned", label: "À planifier" }]}
      rows={[row("f9", { column: 3 })]}
      today={null}
    />,
  );
  const label = screen.getByText("À planifier");
  expect(label.className).not.toContain("font-mono");
  expect(label.parentElement?.textContent).toBe("À planifier");
  expect(container.querySelectorAll('[data-feature="F9"] [data-tone]').length).toBe(2);
});

const top = (el: HTMLElement): number => Number.parseFloat(el.style.top);

test("the today label sits under the rows, never over them", () => {
  const rows = [row("f4"), row("f5")];
  const { container } = render(<SprintTimeline columns={COLUMNS} rows={rows} today={4 / 21} />);
  const label = screen.getByText("aujourd'hui");
  const lastRow = container.querySelector<HTMLElement>('[data-feature="F5"]');
  const grid = label.parentElement;
  if (!lastRow || !grid) throw new Error("timeline missing");
  expect(top(label)).toBeGreaterThanOrEqual(30 + 2 * 30);
  expect(top(label) + 17).toBeLessThanOrEqual(Number.parseFloat(grid.style.height));
});

test("a today label of its own, before the first sprint, reads on the left of the line", () => {
  render(<SprintTimeline columns={COLUMNS} rows={[row("f4")]} today={0} todayLabel="commence dans 4 j" />);
  const label = screen.getByText("commence dans 4 j");
  expect(label.style.transform).toBe("translateX(-100%)");
  expect(screen.queryByText("aujourd'hui")).toBeNull();
});

test("a row may carry a tone and a short note", () => {
  const rows = [
    { ...row("f5"), tone: "risk" as const, note: "glissée de S42" },
    { ...row("f6"), tone: "late" as const },
    row("f4"),
  ];
  const { container } = render(<SprintTimeline columns={COLUMNS} rows={rows} today={null} />);
  const mark = (key: string) => container.querySelector(`[data-feature="${key}"]`)?.getAttribute("data-mark");
  expect([mark("F5"), mark("F6"), mark("F4")]).toEqual(["risk", "late", null]);
  const note = screen.getByText("glissée de S42");
  expect(note.className).toContain("text-(--tracking-amber)");
  expect(screen.getByText("F6").className).toContain("text-(--tracking-red)");
});
