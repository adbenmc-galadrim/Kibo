import { useEffect } from "react";

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false']), .cm-content";

export const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(EDITABLE) !== null;

export const isDestructiveKey = (e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): boolean => (e.key === "Backspace" || e.key === "Delete") && !e.metaKey && !e.ctrlKey && !e.altKey;

export function guardDestructiveKeys(win: Window = window): () => void {
  const listener = (e: KeyboardEvent) => {
    if (isDestructiveKey(e) && !isEditableTarget(e.target)) e.preventDefault();
  };
  win.addEventListener("keydown", listener, true);
  return () => win.removeEventListener("keydown", listener, true);
}

export function useDestructiveKeyGuard(): void {
  useEffect(() => guardDestructiveKeys(), []);
}
