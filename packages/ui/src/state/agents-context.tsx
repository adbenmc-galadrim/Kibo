import type { AgentsState } from "@kibo/schema";
import { createContext, type ReactNode, useContext } from "react";

const AgentsContext = createContext<AgentsState | null>(null);

export function AgentsProvider({ agents, children }: { agents: AgentsState | null; children: ReactNode }) {
  return <AgentsContext.Provider value={agents}>{children}</AgentsContext.Provider>;
}

export const useAgentsState = (): AgentsState | null => useContext(AgentsContext);
