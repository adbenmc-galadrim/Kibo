import { expect, test } from "bun:test";
import fc from "fast-check";
import { type Dir, newGame, step, turn } from "./rules";

const DIRS: Dir[] = ["up", "down", "left", "right"];

test("while alive, the snake stays on the board and never holds a cell twice", () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom(...DIRS), { maxLength: 200 }),
      fc.integer({ min: 5, max: 20 }),
      fc.integer({ min: 5, max: 20 }),
      fc.double({ min: 0, max: 0.999, noNaN: true }),
      (dirs, w, h, seed) => {
        const rng = () => seed;
        let g = newGame(w, h, rng);
        for (const dir of dirs) {
          g = step(turn(g, dir), rng);
          if (!g.alive) break;
          expect(g.snake.every((c) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h)).toBe(true);
          expect(new Set(g.snake.map((c) => `${c.x},${c.y}`)).size).toBe(g.snake.length);
        }
      },
    ),
  );
});
