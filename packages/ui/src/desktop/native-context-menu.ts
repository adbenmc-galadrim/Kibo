const FIELD = "input, textarea, [contenteditable]:not([contenteditable=false])";

export function allowsNativeMenu(target: EventTarget | null, selection: string): boolean {
  if (selection.trim().length > 0) return true;
  return target instanceof Element && target.closest(FIELD) !== null;
}

export function blockNativeContextMenu(root: Document, selection: () => string): () => void {
  const onContextMenu = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    if (!allowsNativeMenu(e.target, selection())) e.preventDefault();
  };
  root.addEventListener("contextmenu", onContextMenu);
  return () => root.removeEventListener("contextmenu", onContextMenu);
}
