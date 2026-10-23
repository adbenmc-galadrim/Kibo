import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphLegend } from "./GraphLegend";
import { SPRINT_LEGEND } from "./sprint-legend-items";

afterEach(cleanup);

const openLegend = () => userEvent.click(screen.getByRole("button", { name: "Légende" }));

test("the legend names the mode", async () => {
  render(<GraphLegend items={SPRINT_LEGEND} />);
  await openLegend();
  const legend = screen.getByRole("list", { name: "Légende" });
  expect(
    within(legend)
      .getAllByRole("listitem")
      .map((i) => i.textContent),
  ).toEqual([
    "À faire",
    "En cours",
    "En review",
    "Bloqué",
    "En attente",
    "Fonctionnalité",
    "Peut commencer",
    "Colonne = sprint",
    "Session active",
  ]);
});

test("the legend is folded on every opening and the Légende button unfolds it", async () => {
  const first = render(<GraphLegend items={SPRINT_LEGEND} />);
  const toggle = screen.getByRole("button", { name: "Légende" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
  await userEvent.click(toggle);
  expect(screen.getByRole("list", { name: "Légende" })).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  first.unmount();
  render(<GraphLegend items={SPRINT_LEGEND} />);
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
});

test("a separator item opens a new group of marks", async () => {
  render(
    <GraphLegend
      items={[
        { key: "a", label: "Brouillon", mark: <span /> },
        { key: "b", label: "Session active", mark: <span />, separator: true },
      ]}
    />,
  );
  await openLegend();
  const items = within(screen.getByRole("list", { name: "Légende" })).getAllByRole("listitem");
  expect(items.map((i) => [i.textContent, i.getAttribute("data-separator")])).toEqual([
    ["Brouillon", null],
    ["Session active", "true"],
  ]);
});
