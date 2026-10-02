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
  return { ref, onScroll };
}
