import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

export const AI_SCENARIOS_DIR = join(import.meta.dir, "scenarios", "ai");
export const FIXTURES_DIR = join(AI_SCENARIOS_DIR, "fixtures");
const HELP_DIR = join(import.meta.dir, "scenarios", "help");

export type WriteLog = { write: string; bypass?: true } | { denied: string; reason: string };
type WriteStep = { write: string; fixture: string; bypassHooks: boolean };
type HookFn = (event: "PreToolUse" | "PostToolUse", extra: Record<string, unknown>) => Promise<string | null>;

const WriteLogEntry = z.union([
  z.object({ denied: z.string(), reason: z.string() }).strict(),
  z.object({ write: z.string(), bypass: z.literal(true).optional() }).strict(),
]);

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

export const aiScenarioPath = (name: string): string => join(AI_SCENARIOS_DIR, name);

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

export async function runWriteStep(
  step: WriteStep,
  ctx: { cwd: string; hook: HookFn; log: (entry: WriteLog) => void },
): Promise<WriteLog> {
  const filePath = resolve(ctx.cwd, step.write);
  const content = readFileSync(join(FIXTURES_DIR, step.fixture), "utf8");
  const write = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  };
  const done = (entry: WriteLog) => {
    ctx.log(entry);
    return entry;
  };
  if (step.bypassHooks) {
    write();
    return done({ write: filePath, bypass: true });
  }
  const toolInput = { file_path: filePath, content };
  const reason = await ctx.hook("PreToolUse", { tool_name: "Write", tool_input: toolInput });
  if (reason !== null) return done({ denied: filePath, reason });
  write();
  await ctx.hook("PostToolUse", {
    tool_name: "Write",
    tool_input: toolInput,
    tool_response: { filePath, success: true },
  });
  return done({ write: filePath });
}

const writesFile = (stateDir: string, sessionId: string): string =>
  join(stateDir, `${sessionId}.writes.jsonl`);

export function appendWrite(stateDir: string, sessionId: string, entry: WriteLog): void {
  appendFileSync(writesFile(stateDir, sessionId), `${JSON.stringify(entry)}\n`);
}

export function fakeWrites(stateDir: string, sessionId: string): WriteLog[] {
  const file = writesFile(stateDir, sessionId);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => WriteLogEntry.parse(JSON.parse(l)));
}

export function fakeMeta(argv: string[], env: Record<string, string | undefined>): string | null {
  if (argv[0] === "--version") return "2.1.283 (Claude Code)\n";
  if (argv.includes("--help")) {
    const name = env.KIBO_FAKE_CLAUDE_HELP === "legacy" ? "legacy.txt" : "claude-2.1.283.txt";
    return readFileSync(join(HELP_DIR, name), "utf8");
  }
  if (argv[0] === "auth" && argv[1] === "status")
    return env.KIBO_FAKE_CLAUDE_LOGGED_OUT === "1"
      ? '{"loggedIn":false}\n'
      : '{"loggedIn":true,"authMethod":"claude.ai"}\n';
  return null;
}
