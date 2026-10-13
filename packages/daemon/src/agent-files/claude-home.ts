import { join } from "node:path";

export type ClaudeEnv = {
  CLAUDE_CONFIG_DIR?: string;
  CLAUDE_CODE_PLUGIN_CACHE_DIR?: string;
  KIBO_CLAUDE_ISOLATED?: string;
};

export function isClaudeIsolated(env: ClaudeEnv): boolean {
  return env.KIBO_CLAUDE_ISOLATED === "1";
}

export function claudeHomeOf(env: ClaudeEnv, userHome: string, kiboHome: string): string {
  if (isClaudeIsolated(env)) return join(kiboHome, "claude");
  return env.CLAUDE_CONFIG_DIR || join(userHome, ".claude");
}

export function pluginsRootOf(env: ClaudeEnv, claudeHome: string): string {
  return env.CLAUDE_CODE_PLUGIN_CACHE_DIR || join(claudeHome, "plugins");
}
