import type { TicketView } from "@kibo/schema";
import { useEffect } from "react";
import { replaceRoute } from "../route";
import { hashToTarget, rememberTicketKey, ticketAddressKey } from "../tabs/target-hash";

export function useTicketAddress(projectId: string, ticket: TicketView | undefined): void {
  const id = ticket?.id ?? null;
  const key = ticket ? ticketAddressKey(ticket) : null;
  useEffect(() => {
    if (id === null || key === null) return;
    rememberTicketKey(projectId, id, key);
    const route = hashToTarget(location.hash);
    if (route?.kind !== "ticket" || route.projectId !== projectId) return;
    if (route.ticketId === id) replaceRoute({ kind: "ticket", projectId, ticketId: id });
  }, [projectId, id, key]);
}
