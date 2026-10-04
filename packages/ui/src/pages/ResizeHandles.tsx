import { frLayout } from "../i18n/fr-layout";
import { type ArrowKey, isArrowKey, type ResizeEdge } from "./layout-resize";

export type Pointer = { x: number; y: number };

export type ResizeHandlesProps = {
  title: string;
  onStart(edge: ResizeEdge, pointer: Pointer): void;
  onMove(pointer: Pointer): void;
  onEnd(): void;
  onKey(key: ArrowKey): void;
};

const HANDLES: readonly { edge: ResizeEdge; label(title: string): string; className: string }[] = [
  { edge: "right", label: frLayout.resizeRight, className: "top-12 right-0 bottom-3 w-2 cursor-ew-resize" },
  { edge: "bottom", label: frLayout.resizeBottom, className: "right-3 bottom-0 left-3 h-2 cursor-ns-resize" },
  {
    edge: "corner",
    label: frLayout.resizeCorner,
    className: "right-0 bottom-0 size-3 cursor-nwse-resize rounded-tl-sm bg-ring/60",
  },
];

export function ResizeHandles({ title, onStart, onMove, onEnd, onKey }: ResizeHandlesProps) {
  return (
    <>
      {HANDLES.map(({ edge, label, className }) => (
        <button
          key={edge}
          type="button"
          data-resize={edge}
          aria-label={label(title)}
          className={`absolute z-10 touch-none rounded-sm outline-none hover:bg-ring/40 focus-visible:ring-2 focus-visible:ring-ring ${className}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            onStart(edge, { x: e.clientX, y: e.clientY });
          }}
          onPointerMove={(e) => onMove({ x: e.clientX, y: e.clientY })}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onKeyDown={(e) => {
            if (!e.shiftKey || e.defaultPrevented || !isArrowKey(e.key)) return;
            e.preventDefault();
            onKey(e.key);
          }}
        />
      ))}
    </>
  );
}
