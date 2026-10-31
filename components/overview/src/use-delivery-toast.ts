import { useCallback, useEffect, useRef, useState } from "react";
import type { FeatureFacts } from "./overview-facts";

export type DeliveryToastRow = { id: string; label: string; title: string; steps: number };

const toasted = new Set<string>();

export function useDeliveryToast(features: readonly FeatureFacts[], ready: boolean) {
  const known = useRef<ReadonlySet<string> | null>(null);
  const [toasts, setToasts] = useState<readonly DeliveryToastRow[]>([]);
  const delivered = features.filter((f) => f.state.status === "delivered");
  const signature = delivered.map((f) => f.id).join(" ");
  const latest = useRef(delivered);
  latest.current = delivered;

  useEffect(() => {
    if (!ready) return;
    const ids = signature === "" ? [] : signature.split(" ");
    const previous = known.current;
    known.current = new Set(ids);
    if (previous === null) return;
    const fresh = latest.current.filter((f) => !previous.has(f.id) && !toasted.has(f.id));
    if (fresh.length === 0) return;
    for (const f of fresh) toasted.add(f.id);
    const rows = fresh.map((f) => ({ id: f.id, label: f.shortKey, title: f.title, steps: f.steps.length }));
    setToasts((shown) => [...shown, ...rows]);
  }, [signature, ready]);

  const close = useCallback((id: string) => {
    setToasts((shown) => shown.filter((t) => t.id !== id));
  }, []);
  return { toasts, close };
}
