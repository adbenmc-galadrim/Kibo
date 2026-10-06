import { type ClientRect, type Translate, useDndContext, useDndMonitor } from "@dnd-kit/core";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

const AT_REST: Translate = { x: 0, y: 0 };

export function DragPreview({ children }: { children: ReactNode }) {
  const { dragOverlay, activeNodeRect } = useDndContext();
  const [dragging, setDragging] = useState(false);
  const [origin, setOrigin] = useState<ClientRect | null>(null);
  const [delta, setDelta] = useState<Translate>(AT_REST);
  if (dragging && origin === null && activeNodeRect !== null) setOrigin(activeNodeRect);
  const stop = () => {
    setDragging(false);
    setOrigin(null);
    setDelta(AT_REST);
  };
  useDndMonitor({
    onDragStart: () => setDragging(true),
    onDragMove: (e) => setDelta(e.delta),
    onDragEnd: stop,
    onDragCancel: stop,
  });
  if (origin === null || children === null) return null;
  return createPortal(
    <div
      ref={dragOverlay.setRef}
      className="fixed z-50"
      style={{
        top: origin.top,
        left: origin.left,
        width: origin.width,
        height: origin.height,
        transform: `translate3d(${delta.x}px, ${delta.y}px, 0)`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
