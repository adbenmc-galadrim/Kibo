import { useLayoutEffect, useState } from "react";

export function useContainerWidth<T extends HTMLElement>(): { ref(el: T | null): void; width: number } {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, width };
}
