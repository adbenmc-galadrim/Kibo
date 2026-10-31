import type { Instance } from "@kibo/schema";
import { useEffect, useState } from "react";
import { type CellMetrics, cellMetrics } from "../lib/format-grid";
import { findComponent } from "../registry";
import { instanceTitle } from "./instance-title";

export function useGridMetrics(ref: React.RefObject<HTMLDivElement | null>): CellMetrics {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(0, el.clientWidth - 32));
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return cellMetrics(width);
}

export function useTitles(instances: readonly Instance[]): (id: string) => string {
  return (id) => {
    const instance = instances.find((i) => i.id === id);
    if (!instance) return id;
    const ref = instance.component;
    const base = findComponent(ref)?.manifest.title ?? ref;
    return instanceTitle(instance, base);
  };
}
