import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SprintPreview } from "./SprintPreview";

const SUMMARY = "6 sprints d'une semaine · du 19 oct. au 27 nov. 2026";

test("SprintPreview lists every planned sprint with its dates", () => {
  render(
    <SprintPreview setup={{ sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 }} summary={SUMMARY} />,
  );
  expect(screen.getByText(SUMMARY)).toBeTruthy();
  const items = within(screen.getByRole("list")).getAllByRole("listitem");
  expect(items.map((i) => i.textContent)).toEqual([
    "S119–23 oct.",
    "S226–30 oct.",
    "S32–6 nov.",
    "S49–13 nov.",
    "S516–20 nov.",
    "S623–27 nov.",
  ]);
});

test("SprintPreview spans months for a two-week sprint", () => {
  render(<SprintPreview setup={{ sprintStart: "2026-10-26", sprintCount: 1, sprintWeeks: 2 }} summary="x" />);
  expect(screen.getByRole("listitem").textContent).toBe("S126 oct.–6 nov.");
});

test("SprintPreview folds the list beyond eight sprints", () => {
  render(
    <SprintPreview setup={{ sprintStart: "2026-10-19", sprintCount: 12, sprintWeeks: 1 }} summary="x" />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(8);
  expect(screen.getByText("… et 4 autres")).toBeTruthy();
});

test("SprintPreview collapses and expands its list", async () => {
  render(
    <SprintPreview setup={{ sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 }} summary={SUMMARY} />,
  );
  const user = userEvent.setup();
  const toggle = screen.getByRole("button", { name: "Masquer les sprints" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  await user.click(toggle);
  expect(screen.queryByRole("list")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Afficher les sprints" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
});
