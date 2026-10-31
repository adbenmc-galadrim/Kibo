import { expect, test } from "bun:test";
import type { CollisionDetection, DroppableContainer } from "@dnd-kit/core";
import { foldedFirst } from "./fold-collision";

const rect = (left: number, width: number) => ({
  top: 0,
  left,
  width,
  height: 800,
  right: left + width,
  bottom: 800,
});

const RECTS = new Map([
  ["backlog", rect(0, 40)],
  ["todo", rect(48, 200)],
]);

const args = (pointer: { x: number; y: number } | null): Parameters<CollisionDetection>[0] => ({
  active: {
    id: "card",
    data: { current: undefined },
    rect: { current: { initial: null, translated: null } },
  },
  collisionRect: { top: 100, left: 20, width: 200, height: 60, right: 220, bottom: 160 },
  droppableRects: RECTS,
  droppableContainers: [...RECTS.keys()].map((id) => ({ id, key: id }) as unknown as DroppableContainer),
  pointerCoordinates: pointer,
});

test("the pointer over an empty column targets it, though the card mostly covers its neighbour", () => {
  const collisions = foldedFirst(["backlog"])(args({ x: 20, y: 120 }));
  expect(collisions.map((c) => c.id)).toEqual(["backlog"]);
});

test("elsewhere the card's overlap decides, as without a folded column", () => {
  expect(foldedFirst(["backlog"])(args({ x: 100, y: 120 }))[0]?.id).toBe("todo");
  expect(foldedFirst(["backlog"])(args(null))[0]?.id).toBe("todo");
});
