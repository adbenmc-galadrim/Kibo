import { join } from "node:path";

export type ClaudeEnv = { CLAUDE_CONFIG_DIR?: string; CLAUDE_CODE_PLUGIN_CACHE_DIR?: string };

export function claudeHomeOf(env: ClaudeEnv, userHome: string): string {
  return env.CLAUDE_CONFIG_DIR || join(userHome, ".claude");
}

export function pluginsRootOf(env: ClaudeEnv, claudeHome: string): string {
  return env.CLAUDE_CODE_PLUGIN_CACHE_DIR || join(claudeHome, "plugins");
}
