import type { FileRef, TabTarget } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { createContext, type ReactNode, useContext } from "react";

export type Host = {
  openTicket(id: string): void;
  openNewTicket(d: NewTicketDefaults): void;
  openAssign(ticketId: string): void;
  openFile(ref: FileRef): void;
  openView(componentId: string): void;
  openTarget(target: TabTarget, opts?: { newTab?: boolean; keep?: boolean }): void;
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

export const useOptionalHost = (): Host | null => useContext(HostContext);
