import { useAutoAnimate as useFormkitAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback } from "react";

export function useAutoAnimate<T extends Element>() {
  const [attach, setEnabled] = useFormkitAutoAnimate<T>();
  const attachIfSupported = useCallback(
    (node: T | null) => {
      if (typeof window.matchMedia === "function") attach(node);
    },
    [attach],
  );
  return [attachIfSupported, setEnabled] as const;
}
