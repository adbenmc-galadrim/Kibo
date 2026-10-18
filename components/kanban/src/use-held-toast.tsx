import type { Question, TicketView } from "@kibo/schema";
import { useCallback, useState } from "react";
import { HeldToast } from "./HeldToast";

type Held = { ticket: TicketView; question: Question; token: number };

export function useHeldToast() {
  const [held, setHeld] = useState<Held | null>(null);
  const close = useCallback(() => setHeld(null), []);
  const hold = useCallback((ticket: TicketView, question: Question) => {
    setHeld((last) => ({ ticket, question, token: (last?.token ?? 0) + 1 }));
  }, []);
  const toast = held && (
    <HeldToast key={held.token} ticketKey={held.ticket.keyLabel} question={held.question} onClose={close} />
  );
  return { hold, toast };
}
