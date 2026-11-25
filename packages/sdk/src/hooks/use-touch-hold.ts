import { type PointerEvent, useEffect, useRef } from "react";

export const TOUCH_DRAG_HOLD_MS = 200;
export const TOUCH_MENU_HOLD_MS = 500;
export const TOUCH_TOLERANCE_PX = 8;
const RELEASE_CLICK_MS = 50;

type Pending = { timer: ReturnType<typeof setTimeout>; x: number; y: number };

const swallow = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

const stopSwallowing = () => window.removeEventListener("click", swallow, { capture: true });

export function useTouchHold(onHold: () => void, delay = TOUCH_MENU_HOLD_MS) {
  const pending = useRef<Pending | null>(null);
  const fired = useRef(false);
  const latest = useRef(onHold);
  latest.current = onHold;
  const clear = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };
  const release = () => {
    clear();
    if (!fired.current) return;
    fired.current = false;
    setTimeout(stopSwallowing, RELEASE_CLICK_MS);
  };
  useEffect(() => clear, []);
  return {
    onPointerDownCapture(event: PointerEvent) {
      release();
      if (event.pointerType !== "touch") return;
      const timer = setTimeout(() => {
        pending.current = null;
        fired.current = true;
        window.addEventListener("click", swallow, { capture: true, once: true });
        latest.current();
      }, delay);
      pending.current = { timer, x: event.clientX, y: event.clientY };
    },
    onPointerMoveCapture(event: PointerEvent) {
      const start = pending.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_TOLERANCE_PX) clear();
    },
    onPointerUpCapture: release,
    onPointerCancelCapture: release,
  };
}
