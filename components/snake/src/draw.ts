import type { Game } from "./rules";

export type BoardColors = { board: string; snake: string; apple: string };
export type Size = { width: number; height: number };
export type Painter = Pick<CanvasRenderingContext2D, "clearRect" | "fillRect" | "fillStyle">;

export function boardLayout(grid: { w: number; h: number }, size: Size) {
  const cell = Math.max(1, Math.floor(Math.min(size.width / grid.w, size.height / grid.h)));
  return {
    cell,
    x: Math.floor((size.width - cell * grid.w) / 2),
    y: Math.floor((size.height - cell * grid.h) / 2),
  };
}

export function drawGame(ctx: Painter, g: Game, size: Size, colors: BoardColors): void {
  const { cell, x, y } = boardLayout(g, size);
  const gap = cell > 6 ? 1 : 0;
  const paint = (cx: number, cy: number) =>
    ctx.fillRect(x + cx * cell + gap, y + cy * cell + gap, cell - 2 * gap, cell - 2 * gap);
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = colors.board;
  ctx.fillRect(x, y, cell * g.w, cell * g.h);
  ctx.fillStyle = colors.apple;
  paint(g.apple.x, g.apple.y);
  ctx.fillStyle = colors.snake;
  for (const c of g.snake) paint(c.x, c.y);
}
