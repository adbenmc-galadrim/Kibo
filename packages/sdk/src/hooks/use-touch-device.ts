import { useSyncExternalStore } from "react";

const COARSE = "(pointer: coarse)";

const query = (): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(COARSE) : null;

function subscribe(listener: () => void): () => void {
  const list = query();
  if (typeof list?.addEventListener !== "function") return () => undefined;
  list.addEventListener("change", listener);
  return () => list.removeEventListener("change", listener);
}

export function useTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, () => query()?.matches === true, () => false);
}
