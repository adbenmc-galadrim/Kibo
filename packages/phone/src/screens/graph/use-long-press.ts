import { type MouseEvent, type PointerEvent, useEffect, useRef } from "react";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;
const RELEASE_CLICK_MS = 300;

type Point = { x: number; y: number };

type LongPressHandlers = {
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(): void;
  onBlur(): void;
  onPointerLeave(): void;
  onPointerCancel(): void;
  onContextMenu(e: MouseEvent): void;
  onClick(): void;
};

export function useLongPress(onLong: () => void, onTap: () => void): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<Point | null>(null);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const fire = () => {
    cancel();
    if (fired.current) return;
    fired.current = true;
    onLong();
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      if (release.current !== null) clearTimeout(release.current);
    },
    [],
  );
  return {
    onPointerDown(e) {
      cancel();
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(fire, LONG_PRESS_MS);
    },
    onPointerMove(e) {
      const from = origin.current;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp() {
      cancel();
      if (!fired.current) return;
      if (release.current !== null) clearTimeout(release.current);
      release.current = setTimeout(() => {
        fired.current = false;
      }, RELEASE_CLICK_MS);
    },
    onBlur() {
      fired.current = false;
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu(e) {
      e.preventDefault();
      fire();
    },
    onClick() {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
  };
}
