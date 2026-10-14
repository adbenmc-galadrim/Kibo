import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import CURRENT_HELP from "./scenarios/help/claude-2.1.283.txt";
import LEGACY_HELP from "./scenarios/help/legacy.txt";

export const AI_SCENARIOS_DIR = join(import.meta.dir, "scenarios", "ai");
export const FIXTURES_DIR = join(AI_SCENARIOS_DIR, "fixtures");

export type WriteLog =
  | { write: string; bypass?: true }
  | { deleted: string; bypass?: true }
  | { denied: string; reason: string };
type WriteStep = { write: string; bypassHooks: boolean } & (
  | { fixture: string }
  | { content: string; binary?: true }
);
type DeleteStep = { delete: string; bypassHooks: boolean };
export const fixturesDir = (env: Record<string, string | undefined> = process.env): string =>
  env.KIBO_FAKE_CLAUDE_FIXTURES ?? FIXTURES_DIR;

export const isDemoAgent = (dir: string, env: Record<string, string | undefined>): boolean =>
  dir.startsWith("/$bunfs") || env.KIBO_FAKE_CLAUDE_DEMO === "1";

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
  z.object({ deleted: z.string(), bypass: z.literal(true).optional() }).strict(),
]);

const Decision = z.object({
  hookSpecificOutput: z.object({
    permissionDecision: z.string(),
    permissionDecisionReason: z.string().optional(),
    additionalContext: z.string().optional(),
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

export function contextOf(text: string): string | null {
  const parsed = Decision.safeParse(hookJson(text));
  return parsed.success ? (parsed.data.hookSpecificOutput.additionalContext ?? null) : null;
}

export function decisionOf(text: string): string | null {
  const parsed = Decision.safeParse(hookJson(text));
  return parsed.success ? parsed.data.hookSpecificOutput.permissionDecision : null;
}

const StopBlock = z.object({ decision: z.literal("block") });
export const blocksStop = (text: string): boolean => StopBlock.safeParse(hookJson(text)).success;

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
  ctx: {
    cwd: string;
    hook: HookFn;
    log: (entry: WriteLog) => void;
    fixtures?: string;
    allowBypass?: boolean;
  },
): Promise<WriteLog> {
  if (step.bypassHooks && ctx.allowBypass === false)
    throw new Error("the demo agent never bypasses the hooks");
  const filePath = resolve(ctx.cwd, step.write);
  const content =
    "content" in step
      ? step.content
      : readFileSync(fixturePath(ctx.fixtures ?? fixturesDir(), step.fixture), "utf8");
  const binary = "content" in step && step.binary === true;
  const write = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, binary ? Buffer.from(content, "base64") : content);
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

export async function runDeleteStep(
  step: DeleteStep,
  ctx: { cwd: string; hook: HookFn; log: (entry: WriteLog) => void; allowBypass?: boolean },
): Promise<WriteLog> {
  if (step.bypassHooks && ctx.allowBypass === false)
    throw new Error("the demo agent never bypasses the hooks");
  const root = resolve(ctx.cwd);
  const filePath = resolve(root, step.delete);
  if (!filePath.startsWith(root + sep)) throw new Error(`path outside cwd: ${step.delete}`);
  const done = (entry: WriteLog) => {
    ctx.log(entry);
    return entry;
  };
  if (step.bypassHooks) {
    rmSync(filePath, { force: true });
    return done({ deleted: filePath, bypass: true });
  }
  const toolInput = { command: `rm ${relative(root, filePath)}` };
  const reason = await ctx.hook("PreToolUse", { tool_name: "Bash", tool_input: toolInput });
  if (reason !== null) return done({ denied: filePath, reason });
  rmSync(filePath, { force: true });
  await ctx.hook("PostToolUse", {
    tool_name: "Bash",
    tool_input: toolInput,
    tool_response: { stdout: "", stderr: "", interrupted: false },
  });
  return done({ deleted: filePath });
}

const ContextLine = z.object({ at: z.number(), tool: z.string(), additionalContext: z.string() });
export type ContextLine = z.infer<typeof ContextLine>;

const contextsFile = (stateDir: string, sessionId: string): string =>
  join(stateDir, `${sessionId}.context.jsonl`);

export function appendContext(stateDir: string, sessionId: string, line: ContextLine): void {
  appendFileSync(contextsFile(stateDir, sessionId), `${JSON.stringify(line)}\n`);
}

export function fakeContexts(stateDir: string, sessionId: string): ContextLine[] {
  const file = contextsFile(stateDir, sessionId);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => ContextLine.parse(JSON.parse(l)));
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

const CWD_VAR = "$CWD/";

const fromCwd = (images: unknown[], cwd: string): unknown[] =>
  images.map((p) =>
    typeof p === "string" && p.startsWith(CWD_VAR) ? join(cwd, p.slice(CWD_VAR.length)) : p,
  );

export function resolveStepInput(
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined>,
  cwd: string = process.cwd(),
): Record<string, unknown> | undefined {
  const input = raw && Array.isArray(raw.images) ? { ...raw, images: fromCwd(raw.images, cwd) } : raw;
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
