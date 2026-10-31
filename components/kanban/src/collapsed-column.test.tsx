import { afterEach, expect, mock, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import type { Status } from "@kibo/schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { KanbanColumn } from "./KanbanColumn";

afterEach(cleanup);

const STATUS = { id: "backlog", label: "Backlog", order: 0 } as Status;

const column = (collapsed: boolean, onAdd = () => {}) =>
  render(
    <DndContext>
      <KanbanColumn status={STATUS} ids={[]} targeted={false} collapsed={collapsed} onAdd={onAdd}>
        {null}
      </KanbanColumn>
    </DndContext>,
  );

test("an empty column renders a 40 px vertical band with the dot, the name and 0 ticket", () => {
  column(true);
  const band = screen.getByRole("region", { name: "Backlog" });
  expect(band.getAttribute("data-collapsed")).toBe("true");
  expect(band.className).toContain("w-10");
  expect(band.className).toContain("shrink-0");
  expect(screen.getByText("Backlog").className).toContain("vertical-rl");
  expect(screen.getByText("0 ticket")).toBeTruthy();
});

test("the band keeps its « + », hidden at rest, shown on hover and focus", () => {
  const onAdd = mock(() => {});
  column(true, onAdd);
  const add = screen.getByRole("button", { name: "Nouveau ticket dans Backlog" });
  expect(add.className).toContain("opacity-0");
  expect(add.className).toContain("group-hover:opacity-100");
  expect(add.className).toContain("focus-visible:opacity-100");
  fireEvent.click(add);
  expect(onAdd).toHaveBeenCalledTimes(1);
});

test("it expands while a card is dragged over it", () => {
  column(false);
  expect(screen.getByRole("region", { name: "Backlog" }).getAttribute("data-collapsed")).toBeNull();
});
