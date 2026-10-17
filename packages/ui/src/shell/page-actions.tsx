import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

type SlotState = { el: HTMLElement | null; set(el: HTMLElement | null): void };
type Slots = { actions: SlotState; presence: SlotState };
const Slot = createContext<Slots | null>(null);

function useSlotState(): SlotState {
  const [el, set] = useState<HTMLElement | null>(null);
  return { el, set };
}

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const actions = useSlotState();
  const presence = useSlotState();
  return <Slot.Provider value={{ actions, presence }}>{children}</Slot.Provider>;
}

export function PagePresenceSlot() {
  const slot = useContext(Slot)?.presence;
  return <div ref={(node) => slot?.set(node)} className="flex items-center empty:hidden" />;
}

export function PageActionsSlot() {
  const slot = useContext(Slot)?.actions;
  return <div ref={(node) => slot?.set(node)} className="flex items-center gap-2 empty:hidden" />;
}

export function PagePresence({ children }: { children: ReactNode }) {
  const el = useContext(Slot)?.presence.el;
  return el ? createPortal(children, el) : null;
}

export function PageActions({ children }: { children: ReactNode }) {
  const el = useContext(Slot)?.actions.el;
  return el ? createPortal(children, el) : null;
}
