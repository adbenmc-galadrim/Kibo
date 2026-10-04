import type { DemoAgentFiles } from "./agent-scenarios";

export const demoAgentEnv = (files: DemoAgentFiles): Record<string, string> => ({
  KIBO_FAKE_CLAUDE_SCENARIO: files.scenario,
  KIBO_FAKE_CLAUDE_STATE: files.state,
  KIBO_FAKE_CLAUDE_FIXTURES: files.fixtures,
  KIBO_FAKE_CLAUDE_DEMO: "1",
});
