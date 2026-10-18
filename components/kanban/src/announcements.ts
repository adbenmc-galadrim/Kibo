import type { Announcements, UniqueIdentifier } from "@dnd-kit/core";
import { fr } from "./fr";

type Refusal = (active: UniqueIdentifier, over: UniqueIdentifier) => string | null;

const NO_REFUSAL: Refusal = () => null;

export function announce(
  labelOf: (id: UniqueIdentifier) => string,
  refusal: Refusal = NO_REFUSAL,
): Announcements {
  return {
    onDragStart: ({ active }) => fr.drag.picked(labelOf(active.id)),
    onDragOver: ({ active, over }) =>
      over ? fr.drag.over(labelOf(active.id), labelOf(over.id)) : fr.drag.outside(labelOf(active.id)),
    onDragEnd: ({ active, over }) =>
      over
        ? (refusal(active.id, over.id) ?? fr.drag.dropped(labelOf(active.id), labelOf(over.id)))
        : fr.drag.cancelled(labelOf(active.id)),
    onDragCancel: ({ active }) => fr.drag.cancelled(labelOf(active.id)),
  };
}
