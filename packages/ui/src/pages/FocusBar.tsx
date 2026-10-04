import { Button } from "@kibo/sdk/ui/button";
import { Maximize2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { frFocus } from "../i18n/fr-focus";
import { dialogOpen, type FocusAction } from "./focus-mode";
import { usePageContext } from "./PageContext";

type Props = { instanceId: string; title: string; dispatch(action: FocusAction): void };

export function FocusBar({ instanceId, title, dispatch }: Props) {
  const exit = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    exit.current?.focus();
    const cell = exit.current?.closest("[data-instance]");
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
  }, [dispatch]);
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
      <Button ref={exit} size="sm" variant="ghost" onClick={() => dispatch({ type: "exit", id: instanceId })}>
        <X aria-hidden />
        {frFocus.exit}
      </Button>
    </div>
  );
}

export function FullscreenButton({ instanceId }: { instanceId: string }) {
  const focus = usePageContext();
  if (!focus) return null;
  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7 shrink-0"
      aria-label={frFocus.enter}
      data-fullscreen=""
      onClick={() => focus.dispatch({ type: "request", id: instanceId, allowed: true })}
    >
      <Maximize2 aria-hidden />
    </Button>
  );
}
