import { type RefObject, useLayoutEffect, useState } from "react";

function wrappedCount(list: HTMLElement): number {
  const items = Array.from(list.children).filter((c) => c instanceof HTMLElement);
  const firstTop = items[0]?.offsetTop ?? 0;
  return items.filter((item) => item.offsetTop > firstTop).length;
}

export function useWrappedCount(ref: RefObject<HTMLElement | null>, itemsKey: string): number {
  const [count, setCount] = useState(0);
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || itemsKey === "") {
      setCount(0);
      return;
    }
    const measure = () => setCount(wrappedCount(list));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const item of Array.from(list.children)) observer.observe(item);
    return () => observer.disconnect();
  }, [ref, itemsKey]);
  return count;
}
