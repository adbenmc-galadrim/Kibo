import { DEFAULT_PROJECT_AGENT_BODY } from "@kibo/core/agents/compose";
import { type Agent, PROJECT_AGENT_REF, systemAgentName, systemAgentSettings } from "@kibo/schema";
import type { AgentSource } from "../runs/neutral-agents";
import { memoryAgent, memoryAgentSource } from "../runs/neutral-agents";

const NAME = systemAgentName("project-agent");
const DESCRIPTION = "Pilote un projet Kibo : lit son état, propose des lots et répond aux questions";

export function projectAgentDefinition(): Agent {
  return memoryAgent({
    ref: PROJECT_AGENT_REF,
    scope: "system",
    name: NAME,
    settings: systemAgentSettings({}),
    file: {
      frontmatter: { name: NAME, description: DESCRIPTION, extra: "", extraKeys: [] },
      body: DEFAULT_PROJECT_AGENT_BODY,
    },
  });
}

export const projectAgentSource = (): AgentSource => memoryAgentSource([projectAgentDefinition()]);
