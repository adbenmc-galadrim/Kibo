import type { Question, TicketView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useEffect, useRef } from "react";
import { fr } from "./fr";
import type { TicketOf } from "./ticket-feature";
import { unblockedFeatures } from "./unblock-toast";

export function useUnblockToast(
  loading: boolean,
  questions: readonly Question[],
  tickets: readonly TicketView[],
  ticketOf: TicketOf,
): void {
  const sdk = useSdk();
  const previous = useRef<readonly Question[] | null>(null);
  useEffect(() => {
    if (loading) return;
    const before = previous.current;
    previous.current = questions;
    if (before === null || before === questions) return;
    for (const label of unblockedFeatures(tickets, ticketOf, before, questions))
      sdk.toast(fr.unblocked(label));
  }, [loading, questions, tickets, ticketOf, sdk]);
}
