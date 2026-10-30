import { useEffect, useRef, useState } from "react";

export type DelayedOpen = {
  open: boolean;
  show(): void;
  cancel(): void;
  schedule(): void;
  close(): void;
};

export function useDelayedOpen(delay: number): DelayedOpen {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = () => {
    cancel();
    setOpen(true);
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return {
    open,
    show,
    cancel,
    schedule: () => {
      cancel();
      timer.current = setTimeout(show, delay);
    },
    close: () => {
      cancel();
      setOpen(false);
    },
  };
}
