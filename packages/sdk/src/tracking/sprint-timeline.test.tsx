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
