import type { Question, TicketView } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TicketOf } from "./ticket-feature";
import { type UnblockedToast, unblockedFeatures, unblockedToast } from "./unblock-toast";

export function useUnblockToast(
  loading: boolean,
  questions: readonly Question[],
  tickets: readonly TicketView[],
  ticketOf: TicketOf,
): { unblocked: UnblockedToast | null; dismiss(): void } {
  const previous = useRef<readonly Question[] | null>(null);
  const [unblocked, setUnblocked] = useState<UnblockedToast | null>(null);
  const dismiss = useCallback(() => setUnblocked(null), []);
  useEffect(() => {
    if (loading) return;
    const before = previous.current;
    previous.current = questions;
    if (before === null || before === questions) return;
    const toast = unblockedToast(unblockedFeatures(tickets, ticketOf, before, questions));
    if (toast !== null) setUnblocked(toast);
  }, [loading, questions, tickets, ticketOf]);
  return { unblocked, dismiss };
}
