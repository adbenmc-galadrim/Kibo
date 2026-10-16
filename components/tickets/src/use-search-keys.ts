import { type KeyboardEvent as ReactKeyboardEvent, useEffect } from "react";

type Key = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">;

const editable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function opensSearch(e: Key): boolean {
  if (e.altKey || editable(e.target)) return false;
  if (e.key === "/") return !e.metaKey && !e.ctrlKey;
  return e.key.toLowerCase() === "f" && (e.metaKey || e.ctrlKey);
}

export function useSearchKeys(global: boolean, open: () => void) {
  useEffect(() => {
    if (!global) return;
    const onKey = (e: KeyboardEvent) => {
      if (!opensSearch(e)) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [global, open]);
  return (e: ReactKeyboardEvent) => {
    if (global || !opensSearch(e)) return;
    e.preventDefault();
    open();
  };
}
