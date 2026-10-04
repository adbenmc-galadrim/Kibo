import { expect, test } from "bun:test";
import { dirFromKeys, dirFromPad, newGame, spawnApple, step, turn } from "./rules";

const rng = () => 0.5;

test("a new game starts centred, moving right, with one apple off the snake", () => {
  const g = newGame(12, 12, rng);
  expect(g.snake[0]).toEqual({ x: 6, y: 6 });
  expect(g.dir).toBe("right");
  expect(g.snake.some((c) => c.x === g.apple.x && c.y === g.apple.y)).toBe(false);
});

test("a step moves, eating grows and scores, walls and self end the game", () => {
  let g = newGame(12, 12, rng);
  g = step({ ...g, apple: { x: 7, y: 6 } }, rng);
  expect(g.snake[0]).toEqual({ x: 7, y: 6 });
  expect(g.score).toBe(1);
  expect(g.snake).toHaveLength(4);
  let wall = newGame(12, 12, rng);
  for (let i = 0; i < 12; i++) wall = step(wall, rng);
  expect(wall.alive).toBe(false);
  expect(turn(g, "left").dir).toBe("right");
  expect(turn(g, "up").next).toBe("up");
  const curled = {
    ...newGame(12, 12, rng),
    snake: [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
    ],
    dir: "left" as const,
    next: "down" as const,
  };
  expect(step(curled, rng).alive).toBe(false);
});

test("the apple only lands on a free cell", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  expect(spawnApple(2, 2, snake, () => 0.99)).toEqual({ x: 1, y: 1 });
});

test("arrows and the left stick give a direction", () => {
  expect(dirFromKeys((code) => code === "ArrowUp")).toBe("up");
  expect(dirFromKeys(() => false)).toBeNull();
  expect(dirFromPad({ axes: [0.9, 0.2] })).toBe("right");
  expect(dirFromPad({ axes: [-0.1, -0.8] })).toBe("up");
  expect(dirFromPad({ axes: [0.1, 0.2] })).toBeNull();
});
