import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

type SlotState = { el: HTMLElement | null; set(el: HTMLElement | null): void };
const Slot = createContext<SlotState | null>(null);

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [el, set] = useState<HTMLElement | null>(null);
  return <Slot.Provider value={{ el, set }}>{children}</Slot.Provider>;
}

export function PageActionsSlot() {
  const slot = useContext(Slot);
  return <div ref={(node) => slot?.set(node)} className="flex items-center gap-2 empty:hidden" />;
}

export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(Slot);
  return slot?.el ? createPortal(children, slot.el) : null;
}
