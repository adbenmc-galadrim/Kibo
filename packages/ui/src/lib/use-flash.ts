import { useCallback, useEffect, useRef, useState } from "react";

export type FlashTone = "ok" | "error";
export type Flash = {
  message: string | null;
  tone: FlashTone;
  flash(message: string, tone?: FlashTone): void;
};

export function useFlash(ms = 4_000): Flash {
  const [state, setState] = useState<{ message: string | null; tone: FlashTone }>({
    message: null,
    tone: "ok",
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(
    (message: string, tone: FlashTone = "ok") => {
      if (timer.current) clearTimeout(timer.current);
      setState({ message, tone });
      timer.current = setTimeout(() => setState((s) => ({ ...s, message: null })), ms);
    },
    [ms],
  );
  return { ...state, flash };
}
