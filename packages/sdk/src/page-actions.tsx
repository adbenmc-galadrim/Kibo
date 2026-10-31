import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

type SlotState = { el: HTMLElement | null; set(el: HTMLElement | null): void };
type Slots = { actions: SlotState };
const Slot = createContext<Slots | null>(null);

function useSlotState(): SlotState {
  const [el, set] = useState<HTMLElement | null>(null);
  return { el, set };
}

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const actions = useSlotState();
  return <Slot.Provider value={{ actions }}>{children}</Slot.Provider>;
}

export function PageActionsSlot() {
  const slot = useContext(Slot)?.actions;
  return <div ref={(node) => slot?.set(node)} className="flex items-center gap-2 empty:hidden" />;
}

export function PageActions({ children, inline }: { children: ReactNode; inline?: boolean }) {
  const slots = useContext(Slot);
  if (slots === null) return inline === true ? children : null;
  return slots.actions.el ? createPortal(children, slots.actions.el) : null;
}
