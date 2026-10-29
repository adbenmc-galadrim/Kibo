import { type Agent, DEMO_AGENT_REF, KiboError, type RunView, SLOT_STATES } from "@kibo/schema";
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

function assignable(agent: Agent, projectId: string): Agent {
  if (!agent.settings.enabled) throw new KiboError("INVALID_INPUT", `agent ${agent.name} is disabled`);
  if (agent.file === null) throw new KiboError("INVALID_INPUT", `agent ${agent.name} has an unreadable file`);
  if (agent.scope === "project" && agent.projectId !== projectId)
    throw new KiboError("INVALID_INPUT", `agent ${agent.name} belongs to another project`);
  return agent;
}

export function knownAgent(data: Pick<AgentDataPort, "agentOf">, ref: string): Agent {
  const found = data.agentOf(ref);
  if (!found) throw new KiboError("AGENT_NOT_FOUND", `agent ${ref} not found`);
  return found;
}

export function ticketAgent(
  data: Pick<AgentDataPort, "agentOf" | "isDemoProject">,
  ref: string,
  projectId: string,
): Agent {
  const found = knownAgent(data, ref);
  if (found.ref === DEMO_AGENT_REF) {
    if (data.isDemoProject(projectId)) return found;
    throw new KiboError("INVALID_INPUT", "the demo agent only works in the demo project");
  }
  if (found.scope === "system")
    throw new KiboError("INVALID_INPUT", `agent ${found.name} is reserved to Kibo`);
  return assignable(found, projectId);
}
