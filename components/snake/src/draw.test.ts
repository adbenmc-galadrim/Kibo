import { expect, test } from "bun:test";
import { boardLayout, drawGame } from "./draw";
import { newGame } from "./rules";

test("the board keeps square cells centred in the canvas", () => {
  expect(boardLayout({ w: 20, h: 10 }, { width: 500, height: 300 })).toEqual({ cell: 25, x: 0, y: 25 });
  expect(boardLayout({ w: 10, h: 10 }, { width: 300, height: 100 })).toEqual({ cell: 10, x: 100, y: 0 });
});

test("the board, every cell of the snake and the apple are painted", () => {
  const painted: [string, number, number][] = [];
  const ctx = {
    fillStyle: "",
    clearRect() {},
    fillRect(x: number, y: number) {
      painted.push([String(this.fillStyle), x, y]);
    },
  };
  const g = { ...newGame(10, 10, () => 0), apple: { x: 0, y: 0 } };
  drawGame(ctx, g, { width: 100, height: 100 }, { board: "b", snake: "s", apple: "a" });
  expect(painted.filter(([c]) => c === "b")).toHaveLength(1);
  expect(painted.filter(([c]) => c === "s")).toHaveLength(3);
  expect(painted.find(([c]) => c === "a")).toEqual(["a", 1, 1]);
});
