import { type RefObject, useLayoutEffect } from "react";
import { dialogOpen, type FocusAction } from "./focus-mode";

export function useFocusedCard(
  focused: boolean,
  card: RefObject<HTMLElement | null>,
  dispatch: ((action: FocusAction) => void) | undefined,
) {
  useLayoutEffect(() => {
    if (!focused || !dispatch) return;
    const cell = card.current?.closest("[data-instance]");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "escape", dialogOpen: dialogOpen() });
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      setTimeout(() => cell?.querySelector<HTMLElement>("[data-fullscreen]")?.focus());
    };
  }, [focused, card, dispatch]);
}
