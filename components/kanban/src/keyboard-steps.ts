import type { KeyboardCoordinateGetter } from "@dnd-kit/core";

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Band = { left: number; width: number };

const GAP = 8;
const BAND_WIDTH = 40;

function bandOnTheWay(code: string, at: Point, card: Size | null, bands: readonly Band[]): Band | undefined {
  const width = card?.width ?? 0;
  const from = at.x + width / 2;
  const reach = width + GAP;
  const centre = (band: Band) => band.left + band.width / 2;
  const distance = (band: Band) => (code === "ArrowRight" ? centre(band) - from : from - centre(band));
  return bands
    .filter((band) => distance(band) > 0 && distance(band) <= reach)
    .sort((a, b) => distance(a) - distance(b))[0];
}

export function stepFor(
  code: string,
  at: Point,
  card: Size | null,
  bands: readonly Band[] = [],
): Point | undefined {
  const down = (card?.height ?? 0) + GAP;
  const across = (card?.width ?? 0) + GAP;
  const band =
    code === "ArrowLeft" || code === "ArrowRight" ? bandOnTheWay(code, at, card, bands) : undefined;
  if (band) return { x: band.left + band.width / 2 - (card?.width ?? 0) / 2, y: at.y };
  const steps: Record<string, Point> = {
    ArrowDown: { x: at.x, y: at.y + down },
    ArrowUp: { x: at.x, y: at.y - down },
    ArrowRight: { x: at.x + across, y: at.y },
    ArrowLeft: { x: at.x - across, y: at.y },
  };
  return steps[code];
}

export const cardSteps: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const bands = [...context.droppableRects.values()].filter((rect) => rect.width <= BAND_WIDTH);
  const next = stepFor(event.code, currentCoordinates, context.collisionRect, bands);
  if (next) event.preventDefault();
  return next;
};
