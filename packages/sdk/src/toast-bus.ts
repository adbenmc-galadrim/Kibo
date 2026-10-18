const TOAST_EVENT = "kibo:toast";

export function emitToast(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}

export function onToast(listener: (message: string) => void): () => void {
  const handle = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === "string") listener(event.detail);
  };
  window.addEventListener(TOAST_EVENT, handle);
  return () => window.removeEventListener(TOAST_EVENT, handle);
}
