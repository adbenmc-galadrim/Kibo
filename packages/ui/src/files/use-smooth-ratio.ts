import { useEffect, useRef, useState } from "react";
import { stepToward } from "./smooth-progress";

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useSmoothRatio(target: number): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const show = (value: number) => {
      current.current = value;
      setShown(value);
    };
    if (reducedMotion()) {
      show(Math.max(current.current, target));
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      show(stepToward(current.current, target, now - last));
      last = now;
      if (current.current < target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}
