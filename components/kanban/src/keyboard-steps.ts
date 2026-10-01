import type { KeyboardCoordinateGetter } from "@dnd-kit/core";

type Point = { x: number; y: number };
type Size = { width: number; height: number };

const GAP = 8;

export function stepFor(code: string, at: Point, card: Size | null): Point | undefined {
  const down = (card?.height ?? 0) + GAP;
  const across = (card?.width ?? 0) + GAP;
  const steps: Record<string, Point> = {
    ArrowDown: { x: at.x, y: at.y + down },
    ArrowUp: { x: at.x, y: at.y - down },
    ArrowRight: { x: at.x + across, y: at.y },
    ArrowLeft: { x: at.x - across, y: at.y },
  };
  return steps[code];
}

export const cardSteps: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const next = stepFor(event.code, currentCoordinates, context.collisionRect);
  if (next) event.preventDefault();
  return next;
};
