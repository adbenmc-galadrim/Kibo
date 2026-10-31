import type { McpTools } from "./ask-mcp";

const dropped = (key: string) =>
  (key.startsWith("CLAUDE") && key !== "CLAUDE_CONFIG_DIR") ||
  key.startsWith("KIBO_HOOK_") ||
  key === "KIBO_RUN_TOKEN" ||
  key === "KIBO_MCP_URL" ||
  key === "KIBO_MCP_TOOLS";

export function cleanEnv(base: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !dropped(key)) env[key] = value;
  }
  return env;
}

export function childEnv(
  base: Record<string, string | undefined>,
  extra: {
    hookUrl: string;
    token: string;
    mcpUrl?: string | null;
    mcpTools?: McpTools;
    env?: Record<string, string>;
  },
): Record<string, string> {
  return {
    ...cleanEnv(base),
    ...cleanEnv(extra.env ?? {}),
    KIBO_HOOK_URL: extra.hookUrl,
    KIBO_RUN_TOKEN: extra.token,
    ...(extra.mcpUrl ? { KIBO_MCP_URL: extra.mcpUrl } : {}),
    ...(extra.mcpTools ? { KIBO_MCP_TOOLS: extra.mcpTools } : {}),
  };
}
