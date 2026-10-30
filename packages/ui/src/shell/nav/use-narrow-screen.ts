import { useState, useSyncExternalStore } from "react";

const NARROW_QUERY = "(max-width: 1179px)";
const NARROW_OPEN_KEY = "kibo.sidebar.narrow-open";

const media = (): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(NARROW_QUERY) : null;

const subscribe = (onChange: () => void) => {
  const query = media();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};

export const useNarrowScreen = (): boolean =>
  useSyncExternalStore(subscribe, () => media()?.matches ?? false);

function storeNarrowOpen(open?: boolean): boolean {
  try {
    if (open !== undefined) localStorage.setItem(NARROW_OPEN_KEY, String(open));
    return localStorage.getItem(NARROW_OPEN_KEY) === "true";
  } catch (e) {
    console.warn("[kibo] sidebar state unavailable", e);
    return open ?? false;
  }
}

export function useSidebarOpen(): { open: boolean; onOpenChange(open: boolean): void } {
  const narrow = useNarrowScreen();
  const [wideOpen, setWideOpen] = useState(true);
  const [narrowOpen, setNarrowOpen] = useState(() => storeNarrowOpen());
  const onOpenChange = (open: boolean) => (narrow ? setNarrowOpen(storeNarrowOpen(open)) : setWideOpen(open));
  return { open: narrow ? narrowOpen : wideOpen, onOpenChange };
}
