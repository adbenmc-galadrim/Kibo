import { afterEach, expect, spyOn, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import type { Status } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { KanbanColumn } from "./KanbanColumn";

afterEach(cleanup);

const STATUS = { id: "todo", label: "À faire", order: 1 } as Status;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

const column = (count: number) =>
  render(
    <DndContext>
      <KanbanColumn status={STATUS} ids={ids(count)} targeted={false} collapsed={false}>
        <div>carte</div>
      </KanbanColumn>
    </DndContext>,
  );

test("the header tooltip reads 38 tickets", () => {
  column(38);
  expect(screen.getByText("38").getAttribute("title")).toBe("38 tickets");
});

test("the header tooltip of a single card reads 1 ticket", () => {
  column(1);
  expect(screen.getByText("1").getAttribute("title")).toBe("1 ticket");
});

const cardListIsWatched = (reduce: boolean): boolean => {
  const media = spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }) as MediaQueryList,
  );
  const observe = spyOn(MutationObserver.prototype, "observe");
  try {
    column(2);
    const list = document.querySelector("[data-slot=kanban-cards]");
    return observe.mock.calls.some(([target]) => target === list);
  } finally {
    media.mockRestore();
    observe.mockRestore();
  }
};

test("auto-animate watches the cards of a column", () => {
  expect(cardListIsWatched(false)).toBe(true);
});

test("with reduced motion auto-animate leaves the cards of a column alone", () => {
  expect(cardListIsWatched(true)).toBe(false);
});
