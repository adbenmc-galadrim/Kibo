import { type Agent, KiboError, type RunView, SLOT_STATES } from "@kibo/schema";
import type { AgentDataPort } from "./orchestrator-types";

export const holdsSlot = (r: RunView): boolean => SLOT_STATES.includes(r.state);

export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function guarded(what: string, action: () => void): void {
  try {
    action();
  } catch (e) {
    console.error(`[kibo-daemon] ${what} failed`, e);
  }
}

export function knownAgent(data: Pick<AgentDataPort, "agentOf">, ref: string): Agent {
  const found = data.agentOf(ref);
  if (!found) throw new KiboError("AGENT_NOT_FOUND", `agent ${ref} not found`);
  return found;
}
