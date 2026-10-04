export type Dir = "up" | "down" | "left" | "right";
export type Cell = { x: number; y: number };
export type Game = {
  w: number;
  h: number;
  snake: Cell[];
  dir: Dir;
  next: Dir;
  apple: Cell;
  score: number;
  alive: boolean;
};

const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export function spawnApple(w: number, h: number, snake: readonly Cell[], rng: () => number): Cell {
  const free: Cell[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (!snake.some((c) => c.x === x && c.y === y)) free.push({ x, y });
  return free[Math.min(free.length - 1, Math.floor(rng() * free.length))] ?? { x: 0, y: 0 };
}

export function newGame(w: number, h: number, rng: () => number): Game {
  const head = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
  const snake = [head, { x: head.x - 1, y: head.y }, { x: head.x - 2, y: head.y }];
  return {
    w,
    h,
    snake,
    dir: "right",
    next: "right",
    apple: spawnApple(w, h, snake, rng),
    score: 0,
    alive: true,
  };
}

export const turn = (g: Game, dir: Dir): Game => (dir === OPPOSITE[g.dir] ? g : { ...g, next: dir });

export function step(g: Game, rng: () => number): Game {
  if (!g.alive) return g;
  const dir = g.next;
  const head = g.snake[0];
  if (!head) return { ...g, alive: false };
  const to = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  const eats = sameCell(to, g.apple);
  const body = eats ? g.snake : g.snake.slice(0, -1);
  const outside = to.x < 0 || to.y < 0 || to.x >= g.w || to.y >= g.h;
  if (outside || body.some((c) => sameCell(c, to))) return { ...g, dir, alive: false };
  const snake = [to, ...body];
  return {
    ...g,
    dir,
    snake,
    score: g.score + (eats ? 1 : 0),
    apple: eats ? spawnApple(g.w, g.h, snake, rng) : g.apple,
  };
}

export const dirFromKeys = (isDown: (code: string) => boolean): Dir | null =>
  isDown("ArrowUp")
    ? "up"
    : isDown("ArrowDown")
      ? "down"
      : isDown("ArrowLeft")
        ? "left"
        : isDown("ArrowRight")
          ? "right"
          : null;

export function dirFromPad(pad: { axes: readonly number[] }): Dir | null {
  const [x = 0, y = 0] = pad.axes;
  if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}
