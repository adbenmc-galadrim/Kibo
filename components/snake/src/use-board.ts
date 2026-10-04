import { type RefObject, useEffect } from "react";

export function useBoardSize(canvas: RefObject<HTMLCanvasElement | null>, redraw: () => void): void {
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.round(el.clientWidth * ratio);
      el.height = Math.round(el.clientHeight * ratio);
      redraw();
    };
    fit();
    const watchers: { disconnect(): void }[] = [];
    if (typeof ResizeObserver !== "undefined") {
      const resize = new ResizeObserver(fit);
      resize.observe(el);
      watchers.push(resize);
    }
    if (typeof MutationObserver !== "undefined") {
      const theme = new MutationObserver(redraw);
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      watchers.push(theme);
    }
    return () => {
      for (const w of watchers) w.disconnect();
    };
  }, [canvas, redraw]);
}

export function boardColors(el: Element) {
  const style = getComputedStyle(el);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return { board: read("--muted"), snake: read("--foreground"), apple: read("--destructive") };
}
