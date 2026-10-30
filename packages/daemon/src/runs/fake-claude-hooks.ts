import { z } from "zod";
import CURRENT_HELP from "./scenarios/help/claude-2.1.283.txt";
import LEGACY_HELP from "./scenarios/help/legacy.txt";

const Decision = z.object({
  hookSpecificOutput: z.object({
    permissionDecision: z.string(),
    permissionDecisionReason: z.string().optional(),
  }),
});

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hookJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    process.stderr.write(`fake-claude: hook output is not JSON: ${String(error)}\n`);
    return null;
  }
}

export function decisionOf(text: string): string | null {
  const parsed = Decision.safeParse(hookJson(text));
  return parsed.success ? parsed.data.hookSpecificOutput.permissionDecision : null;
}

const StopBlock = z.object({ decision: z.literal("block") });
export const blocksStop = (text: string): boolean => StopBlock.safeParse(hookJson(text)).success;

export function denialReason(stdouts: string[]): string | null {
  for (const out of stdouts) {
    const trimmed = out.trim();
    if (!trimmed.startsWith("{")) continue;
    const parsed = Decision.safeParse(parseJson(trimmed));
    if (parsed.success && parsed.data.hookSpecificOutput.permissionDecision === "deny")
      return parsed.data.hookSpecificOutput.permissionDecisionReason ?? "denied";
  }
  return null;
}

export function fakeMeta(argv: string[], env: Record<string, string | undefined>): string | null {
  if (argv[0] === "--version") return "2.1.283 (Claude Code)\n";
  if (argv.includes("--help")) {
    return env.KIBO_FAKE_CLAUDE_HELP === "legacy" ? LEGACY_HELP : CURRENT_HELP;
  }
  if (argv[0] === "auth" && argv[1] === "status")
    return env.KIBO_FAKE_CLAUDE_LOGGED_OUT === "1"
      ? '{"loggedIn":false}\n'
      : '{"loggedIn":true,"authMethod":"claude.ai"}\n';
  return null;
}
