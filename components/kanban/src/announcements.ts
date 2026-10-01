import type { Announcements, UniqueIdentifier } from "@dnd-kit/core";
import { fr } from "./fr";

export function announce(labelOf: (id: UniqueIdentifier) => string): Announcements {
  return {
    onDragStart: ({ active }) => fr.drag.picked(labelOf(active.id)),
    onDragOver: ({ active, over }) =>
      over ? fr.drag.over(labelOf(active.id), labelOf(over.id)) : fr.drag.outside(labelOf(active.id)),
    onDragEnd: ({ active, over }) =>
      over ? fr.drag.dropped(labelOf(active.id), labelOf(over.id)) : fr.drag.cancelled(labelOf(active.id)),
    onDragCancel: ({ active }) => fr.drag.cancelled(labelOf(active.id)),
  };
}
