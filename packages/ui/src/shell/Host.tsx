import type { FileRef } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { createContext, type ReactNode, useContext } from "react";

export type Host = {
  openTicket(id: string): void;
  openNewTicket(d: NewTicketDefaults): void;
  openAssign(ticketId: string): void;
  openFile(ref: FileRef): void;
};
const HostContext = createContext<Host | null>(null);

export function HostProvider({ host, children }: { host: Host; children: ReactNode }) {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useHost(): Host {
  const host = useContext(HostContext);
  if (!host) throw new Error("useHost must be used inside <HostProvider>");
  return host;
}
