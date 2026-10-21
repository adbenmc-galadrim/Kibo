import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphLegend } from "./GraphLegend";
import { SPRINT_LEGEND } from "./sprint-legend-items";

afterEach(cleanup);

test("the legend names the mode", () => {
  render(<GraphLegend items={SPRINT_LEGEND} />);
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
    "Colonne = sprint",
    "Session active",
  ]);
});

test("the Légende button folds the legend and the choice is remembered", async () => {
  localStorage.removeItem("kibo.graph.legend");
  const first = render(<GraphLegend items={SPRINT_LEGEND} />);
  const toggle = screen.getByRole("button", { name: "Légende" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  await userEvent.click(toggle);
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
  expect(screen.getByRole("button", { name: "Légende" }).getAttribute("aria-expanded")).toBe("false");
  first.unmount();
  render(<GraphLegend items={SPRINT_LEGEND} />);
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Légende" }));
  expect(screen.getByRole("list", { name: "Légende" })).toBeTruthy();
  localStorage.removeItem("kibo.graph.legend");
});

test("the legend opens when the storage cannot be read", () => {
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = () => {
    throw new Error("denied");
  };
  try {
    render(<GraphLegend items={SPRINT_LEGEND} />);
    expect(screen.getByRole("list", { name: "Légende" })).toBeTruthy();
  } finally {
    Storage.prototype.getItem = getItem;
  }
});

test("a separator item opens a new group of marks", () => {
  render(
    <GraphLegend
      items={[
        { key: "a", label: "Brouillon", mark: <span /> },
        { key: "b", label: "Session active", mark: <span />, separator: true },
      ]}
    />,
  );
  const items = within(screen.getByRole("list", { name: "Légende" })).getAllByRole("listitem");
  expect(items.map((i) => [i.textContent, i.getAttribute("data-separator")])).toEqual([
    ["Brouillon", null],
    ["Session active", "true"],
  ]);
});
