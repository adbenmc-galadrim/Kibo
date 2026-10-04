import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { z } from "zod";
import CURRENT_HELP from "./scenarios/help/claude-2.1.283.txt";
import LEGACY_HELP from "./scenarios/help/legacy.txt";

export const AI_SCENARIOS_DIR = join(import.meta.dir, "scenarios", "ai");
export const FIXTURES_DIR = join(AI_SCENARIOS_DIR, "fixtures");

export type WriteLog = { write: string; bypass?: true } | { denied: string; reason: string };
type WriteStep = { write: string; fixture: string; bypassHooks: boolean };
export const fixturesDir = (env: Record<string, string | undefined> = process.env): string =>
  env.KIBO_FAKE_CLAUDE_FIXTURES ?? FIXTURES_DIR;

function fixturePath(dir: string, fixture: string): string {
  const root = resolve(dir);
  const file = resolve(root, fixture);
  if (!file.startsWith(root + sep)) throw new Error(`fixture ${fixture} is outside the fixtures dir`);
  return file;
}

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
  ctx: { cwd: string; hook: HookFn; log: (entry: WriteLog) => void; fixtures?: string },
): Promise<WriteLog> {
  const filePath = resolve(ctx.cwd, step.write);
  const content = readFileSync(fixturePath(ctx.fixtures ?? fixturesDir(), step.fixture), "utf8");
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

const ATTACHMENTS_VAR = "$KIBO_DRAFT_ATTACHMENTS";

export function resolveStepInput(
  input: Record<string, unknown> | undefined,
  env: Record<string, string | undefined>,
): Record<string, unknown> | undefined {
  const path = input?.file_path;
  if (typeof path !== "string" || !(path === ATTACHMENTS_VAR || path.startsWith(`${ATTACHMENTS_VAR}/`)))
    return input;
  const dir = env.KIBO_DRAFT_ATTACHMENTS;
  if (!dir) throw new Error("KIBO_DRAFT_ATTACHMENTS is not set for a step that reads an attachment");
  return { ...input, file_path: dir + path.slice(ATTACHMENTS_VAR.length) };
}

const ToolUse = z.object({ tool: z.string(), input: z.record(z.string(), z.unknown()), denied: z.boolean() });
export type ToolUse = z.infer<typeof ToolUse>;

const toolUsesFile = (stateDir: string, sessionId: string): string =>
  join(stateDir, `${sessionId}.tools.jsonl`);

export function appendToolUse(stateDir: string, sessionId: string, use: ToolUse): void {
  appendFileSync(toolUsesFile(stateDir, sessionId), `${JSON.stringify(use)}\n`);
}

export function fakeToolUses(stateDir: string, sessionId: string): ToolUse[] {
  const file = toolUsesFile(stateDir, sessionId);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => ToolUse.parse(JSON.parse(l)));
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
