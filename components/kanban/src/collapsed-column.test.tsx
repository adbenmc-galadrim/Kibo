import { afterEach, expect, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import type { Status } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { KanbanColumn } from "./KanbanColumn";

afterEach(cleanup);

const STATUS = { id: "backlog", label: "Backlog", order: 0 } as Status;

const column = (ids: string[], targeted: boolean) =>
  render(
    <DndContext>
      <KanbanColumn status={STATUS} ids={ids} targeted={targeted} onAdd={() => {}}>
        {ids.map((id) => (
          <div key={id}>{id}</div>
        ))}
      </KanbanColumn>
    </DndContext>,
  ).container;

test("an empty column renders a 40 px vertical band with the dot, the name and 0 ticket", () => {
  column([], false);
  const band = screen.getByRole("region", { name: "Backlog" });
  expect(band.getAttribute("data-collapsed")).toBe("true");
  expect(band.className).toContain("w-10");
  expect(band.className).toContain("shrink-0");
  expect(band.firstElementChild?.tagName).toBeTruthy();
  expect(screen.getByText("Backlog").className).toContain("vertical-rl");
  expect(screen.getByText("0 ticket")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

test("it expands while a card is dragged over it", () => {
  column([], true);
  const section = screen.getByRole("region", { name: "Backlog" });
  expect(section.getAttribute("data-collapsed")).toBeNull();
  expect(screen.getByRole("button", { name: "Nouveau ticket dans Backlog" })).toBeTruthy();
});

test("a column with cards stays open", () => {
  column(["a"], false);
  expect(screen.getByRole("region", { name: "Backlog" }).getAttribute("data-collapsed")).toBeNull();
});
