import { type CollisionDetection, pointerWithin, rectIntersection } from "@dnd-kit/core";

export const foldedFirst =
  (emptyColumns: readonly string[]): CollisionDetection =>
  (args) => {
    const folded = pointerWithin(args).filter((c) => emptyColumns.includes(String(c.id)));
    return folded.length > 0 ? folded : rectIntersection(args);
  };
