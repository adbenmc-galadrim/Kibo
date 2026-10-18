import type { Question, TicketView } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TicketOf } from "./ticket-feature";
import { type Unblocked, unblockedFeatures } from "./unblock-toast";

export function useUnblockToast(
  loading: boolean,
  questions: readonly Question[],
  tickets: readonly TicketView[],
  ticketOf: TicketOf,
): { unblocked: Unblocked | null; dismiss(): void } {
  const previous = useRef<readonly Question[] | null>(null);
  const [unblocked, setUnblocked] = useState<Unblocked | null>(null);
  const dismiss = useCallback(() => setUnblocked(null), []);
  useEffect(() => {
    if (loading) return;
    const before = previous.current;
    previous.current = questions;
    if (before === null || before === questions) return;
    const latest = unblockedFeatures(tickets, ticketOf, before, questions).at(-1);
    if (latest !== undefined) setUnblocked(latest);
  }, [loading, questions, tickets, ticketOf]);
  return { unblocked, dismiss };
}
