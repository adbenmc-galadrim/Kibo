import type { Agent } from "@kibo/schema";
import { type HookLauncher, writeMcpConfig } from "./hook-launcher";

export type McpLaunchInput = {
  agent: Pick<Agent, "settings">;
  baseUrl: string;
  runId: string;
  runDir: string;
  hook: HookLauncher;
  token: string;
};
export type McpRoute = { mcpUrl: string; mcpTools: "project"; mcpConfigFile: string };
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
