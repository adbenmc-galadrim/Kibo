import { createSignal, type Signal } from "@kibo/sdk";
import { type RefObject, useEffect, useState } from "react";

export function useVisibility(ref: RefObject<Element | null>): Signal<boolean> {
  const [signal] = useState(() => createSignal(true));
  useEffect(() => {
    let stop: (() => void) | null = null;
    let live = true;
    import("./visibility-watch").then(
      (m) => {
        if (live) stop = m.watchVisibility(ref.current, signal.set);
      },
      (e: unknown) => console.error("[kibo-ui] visibility watch not loaded", e),
    );
    return () => {
      live = false;
      stop?.();
    };
  }, [ref, signal]);
  return signal;
}
