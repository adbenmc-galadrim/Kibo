import { expect, test } from "bun:test";
import { BACKLOG_ID, planDrop } from "./drag";

const cards = [
  { id: "f9", sprintId: null },
  { id: "f3", sprintId: "s42" },
];

test("dropping a card on a sprint column plans it there", () => {
  expect(planDrop({ activeId: "f9", overId: "s44", cards })).toEqual({ ticketId: "f9", sprintId: "s44" });
});

test("dropping on the backlog removes the sprint", () => {
  expect(planDrop({ activeId: "f3", overId: BACKLOG_ID, cards })).toEqual({ ticketId: "f3", sprintId: null });
});

test("a delivered feature can move too", () => {
  expect(planDrop({ activeId: "f3", overId: "s43", cards })).toEqual({ ticketId: "f3", sprintId: "s43" });
});

test("nothing happens outside the columns, in the same column, or for a step", () => {
  expect(planDrop({ activeId: "f9", overId: null, cards })).toBeNull();
  expect(planDrop({ activeId: "f3", overId: "s42", cards })).toBeNull();
  expect(planDrop({ activeId: "f9", overId: BACKLOG_ID, cards })).toBeNull();
  expect(planDrop({ activeId: "step-1", overId: "s44", cards })).toBeNull();
});
