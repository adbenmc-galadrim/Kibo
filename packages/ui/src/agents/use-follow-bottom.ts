import { useCallback, useLayoutEffect, useRef } from "react";

const SLACK = 8;

export function useFollowBottom<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const following = useRef(true);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= SLACK;
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && following.current && count > 0) el.scrollTop = el.scrollHeight;
  }, [count]);
  useLayoutEffect(() => {
    void count;
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (following.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [count]);
  const release = useCallback(() => {
    following.current = false;
  }, []);
  return { ref, onScroll, release };
}
