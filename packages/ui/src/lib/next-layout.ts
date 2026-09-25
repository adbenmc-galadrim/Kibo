import type { Layout } from "@kibo/schema";

const COLUMNS = 12;
const SIZE = { w: 6, h: 6 };

const overlaps = (a: Layout, b: Layout): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function nextLayout(taken: Layout[]): Layout {
  for (let y = 0; ; y += SIZE.h) {
    for (let x = 0; x + SIZE.w <= COLUMNS; x += SIZE.w) {
      const slot = { x, y, ...SIZE };
      if (!taken.some((t) => overlaps(slot, t))) return slot;
    }
  }
}
