import { useLayoutEffect, useReducer, useRef } from "react";
import { flushSync } from "react-dom";

function canAnimate(): boolean {
  return (
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function usePageTransition<T>(value: T, key: string): T {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const latest = useRef({ key, value });
  const shown = useRef(latest.current);
  latest.current = { key, value };
  if (shown.current.key === key || !canAnimate()) shown.current = latest.current;

  useLayoutEffect(() => {
    if (shown.current.key === key) return;
    document.startViewTransition(() => {
      flushSync(() => {
        shown.current = latest.current;
        rerender();
      });
    });
  }, [key]);

  return shown.current.value;
}
