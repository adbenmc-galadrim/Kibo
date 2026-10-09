import { useRef } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { PANEL_STEP } from "./use-panel-width";

type Props = { width: number; onResize(width: number): void };
type Drag = { x: number; width: number };

export function ResizeEdge({ width, onResize }: Props) {
  const drag = useRef<Drag | null>(null);
  return (
    <button
      type="button"
      aria-label={frProjectAgent.resize}
      className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-ew-resize touch-none outline-none hover:bg-ring/40 focus-visible:bg-ring/60"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, width };
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (start) onResize(start.width + start.x - e.clientX);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        onResize(width + (e.key === "ArrowLeft" ? PANEL_STEP : -PANEL_STEP));
      }}
    />
  );
}
