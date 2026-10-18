import type { TabTarget, TicketView } from "@kibo/schema";
import { useLayoutEffect, useRef } from "react";
import { findTicket, rememberTicketKey, targetToHash, ticketAddressKey } from "../tabs/target-hash";

export type SheetRef = { projectId: string; ticketId: string };
type Own = { sheet: string; hash: string; under: TabTarget | null; underHash: string };

const sheetId = (s: SheetRef): string => `${s.projectId}\n${s.ticketId}`;
const urlOf = (hash: string): string => hash || `${location.pathname}${location.search}`;

function addressOf(sheet: SheetRef, tickets: readonly TicketView[] | null): string | null {
  const ticket = tickets ? findTicket(tickets, sheet.ticketId) : undefined;
  if (!ticket) return null;
  const key = ticketAddressKey(ticket);
  if (key) rememberTicketKey(sheet.projectId, ticket.id, key);
  return targetToHash({ kind: "ticket", projectId: sheet.projectId, ticketId: ticket.id });
}

export function useSheetAddress(
  sheet: SheetRef | null,
  tickets: readonly TicketView[] | null,
  route: TabTarget | null,
  close: () => void,
): TabTarget | null {
  const own = useRef<Own | null>(null);
  useLayoutEffect(() => {
    const mine = own.current;
    if (mine && location.hash !== mine.hash) {
      own.current = null;
      if (sheet) close();
      return;
    }
    if (sheet === null) {
      if (mine) history.replaceState(history.state, "", urlOf(mine.underHash));
      own.current = null;
      return;
    }
    if (mine?.sheet === sheetId(sheet)) return;
    const address = addressOf(sheet, tickets);
    if (address === null) return;
    const underHash = mine?.underHash ?? location.hash;
    history.replaceState(history.state, "", urlOf(address));
    own.current = { sheet: sheetId(sheet), hash: location.hash, under: mine?.under ?? route, underHash };
  });
  const mine = own.current;
  return mine && location.hash === mine.hash ? mine.under : route;
}
