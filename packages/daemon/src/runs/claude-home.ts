export type ClaudeEnv = { KIBO_CLAUDE_ISOLATED?: string };

export function isClaudeIsolated(env: ClaudeEnv): boolean {
  return env.KIBO_CLAUDE_ISOLATED === "1";
}
