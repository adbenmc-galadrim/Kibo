import { type CollisionDetection, pointerWithin, rectIntersection } from "@dnd-kit/core";

type Args = Parameters<CollisionDetection>[0];

const rectCentre = ({ collisionRect: r }: Args) => ({
  x: r.left + r.width / 2,
  y: r.top + r.height / 2,
});

export const foldedFirst =
  (emptyColumns: readonly string[]): CollisionDetection =>
  (args) => {
    const pointerCoordinates = args.pointerCoordinates ?? rectCentre(args);
    const folded = pointerWithin({ ...args, pointerCoordinates }).filter((c) =>
      emptyColumns.includes(String(c.id)),
    );
    return folded.length > 0 ? folded : rectIntersection(args);
  };
