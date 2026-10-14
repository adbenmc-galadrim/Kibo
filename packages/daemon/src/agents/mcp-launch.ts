import { type Agent, ALLOW_MAX, isSafeAllowRule, KiboError } from "@kibo/schema";
import { type HookLauncher, writeMcpConfig } from "./hook-launcher";

export type McpLaunchInput = {
  agent: Pick<Agent, "settings">;
  baseUrl: string;
  runId: string;
  runDir: string;
  hook: HookLauncher;
  token: string;
};
export type McpRoute = { mcpUrl: string; mcpTools: "project" | "ticket"; mcpConfigFile: string };
export type McpLaunch = McpRoute & { allow: string[]; deny: readonly string[] };

export function mcpRoute(input: McpLaunchInput, tools: McpRoute["mcpTools"]): McpRoute {
  const mcpUrl = `${input.baseUrl}/agent-mcp/${input.runId}`;
  return {
    mcpUrl,
    mcpTools: tools,
    mcpConfigFile: writeMcpConfig(input.runDir, input.hook, {
      KIBO_MCP_URL: mcpUrl,
      KIBO_RUN_TOKEN: input.token,
      KIBO_MCP_TOOLS: tools,
    }),
  };
}

function assertSafe(origin: string, rules: readonly string[]): void {
  const unsafe = rules.find((rule) => !isSafeAllowRule(rule));
  if (unsafe !== undefined)
    throw new KiboError("INVALID_INPUT", `${origin} rule ${unsafe} is unsafe or malformed`);
}

function mergedAllow(agent: readonly string[], project: readonly string[]): string[] {
  assertSafe("agent", agent);
  assertSafe("project", project);
  const merged = [...new Set([...agent, ...project])];
  if (merged.length > ALLOW_MAX)
    throw new KiboError(
      "INVALID_INPUT",
      `${merged.length} permission rules for the agent and the project, ${ALLOW_MAX} at most`,
    );
  return merged;
}

export function ticketLaunch(input: McpLaunchInput & { projectAllow: readonly string[] }): McpLaunch {
  const allow = mergedAllow(input.agent.settings.allow, input.projectAllow);
  return { allow, deny: [], ...mcpRoute(input, "ticket") };
}
