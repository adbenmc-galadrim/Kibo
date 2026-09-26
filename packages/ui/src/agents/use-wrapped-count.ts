import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from "react";

export function useWrappedCount(ref: RefObject<HTMLElement | null>): number {
  const [count, setCount] = useState(0);
  const measure = useCallback(() => {
    const list = ref.current;
    if (!list) return;
    const items = Array.from(list.children).filter((c) => c instanceof HTMLElement);
    const firstTop = items[0]?.offsetTop ?? 0;
    setCount(items.filter((item) => item.offsetTop > firstTop).length);
  }, [ref]);
  useLayoutEffect(measure);
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [ref, measure]);
  return count;
}
