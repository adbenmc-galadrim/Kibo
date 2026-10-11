import { type KeyboardEvent, useRef } from "react";
import { fr } from "../../i18n/fr";
import { DOCK_MIN, DOCK_STEP } from "./use-dock-height";

type Props = { height: number; max: number; onResize(height: number): void; onReset(): void };
type Drag = { y: number; height: number };

export function ResizeBar({ height, max, onResize, onReset }: Props) {
  const drag = useRef<Drag | null>(null);
  const end = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLHRElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    onResize(height + (e.key === "ArrowUp" ? DOCK_STEP : -DOCK_STEP));
  };
  return (
    <div className="relative h-2 shrink-0">
      <hr
        tabIndex={0}
        aria-label={fr.agents.resize}
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={DOCK_MIN}
        aria-valuemax={max}
        className="peer absolute inset-0 m-0 h-full w-full cursor-ns-resize touch-none border-0 outline-none focus-visible:bg-ring/30"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { y: e.clientY, height };
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (start) onResize(start.height + start.y - e.clientY);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={onReset}
        onKeyDown={onKeyDown}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/40 peer-hover:bg-muted-foreground/70"
      />
    </div>
  );
}
