import { type ClientRect, useDndContext, useDndMonitor } from "@dnd-kit/core";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

export function DragPreview({ children }: { children: ReactNode }) {
  const { dragOverlay, activeNodeRect } = useDndContext();
  const [dragging, setDragging] = useState(false);
  const [origin, setOrigin] = useState<ClientRect | null>(null);
  const [place, setPlace] = useState<ClientRect | null>(null);
  if (dragging && origin === null && activeNodeRect !== null) setOrigin(activeNodeRect);
  const stop = () => {
    setDragging(false);
    setOrigin(null);
    setPlace(null);
  };
  useDndMonitor({
    onDragStart: () => setDragging(true),
    onDragMove: ({ active }) => setPlace(active.rect.current.translated),
    onDragEnd: stop,
    onDragCancel: stop,
  });
  if (origin === null || children === null) return null;
  const base = dragOverlay.rect ?? origin;
  const x = place ? place.left - base.left : 0;
  const y = place ? place.top - base.top : 0;
  return createPortal(
    <div
      ref={dragOverlay.setRef}
      className="fixed z-50"
      style={{
        top: origin.top,
        left: origin.left,
        width: origin.width,
        height: origin.height,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
