import { homedir } from "node:os";
import { join } from "node:path";
import {
  type AgentModel,
  AllowRules,
  ASK_TOOL,
  HookEventName,
  KiboError,
  type PermissionMode,
} from "@kibo/schema";
import { z } from "zod";
import { signalGroup } from "../process-group";
import { type HookLauncher, hookShellCommand, mcpServerConfig } from "./hook-launcher";
import { parseJsonLine, Usage, usageTokens } from "./transcript";

export type LaunchInput = {
  claudeBin: string;
  cwd: string;
  model: AgentModel;
  permissionFlag: string | null;
  extraArgs: string[];
  sessionId: string;
  resume: boolean;
  prompt: string;
  systemPromptFile: string;
  hook: HookLauncher;
  allow: readonly string[];
  hookUrl: string;
  token: string;
  baseEnv: Record<string, string | undefined>;
  extraEnv: Record<string, string>;
};
export type StreamResult = {
  isError: boolean;
  result: string | null;
  tokens: number;
  costUsd: number;
  denied: string[];
  raw: string;
};
export type CliCaps = { permissionModes: string[] };
export type PsReader = (pid: number) => string | null;
export type ProcessOutcome = { code: number; result: StreamResult | null; stderrTail: string };
export type RunProcess = { pid: number; kill(): void; exited: Promise<ProcessOutcome> };

const TOOL_EVENTS = new Set<string>(["PreToolUse", "PostToolUse"]);

function profileRules(allow: readonly string[]): string[] {
  const rules = AllowRules.safeParse(allow.filter((rule) => rule !== ASK_TOOL));
  if (!rules.success)
    throw new KiboError("INVALID_INPUT", "the profile carries an unsafe or malformed permission rule");
  return [...new Set(rules.data)];
}

export function claudeSettings(hook: HookLauncher, allow: readonly string[] = []): string {
  const rules = profileRules(allow);
  const command = hookShellCommand(hook);
  const hooks = Object.fromEntries(
    HookEventName.options.map((event) => [
      event,
      [
        {
          ...(TOOL_EVENTS.has(event) ? { matcher: "*" } : {}),
          hooks: [{ type: "command", command, timeout: 10 }],
        },
      ],
    ]),
  );
  return JSON.stringify({ hooks, permissions: { allow: [ASK_TOOL, ...rules] } });
}

const RESERVED_ARGS = new Set([
  "--dangerously-skip-permissions",
  "--allow-dangerously-skip-permissions",
  "--permission-mode",
  "--permission-prompts",
  "--settings",
  "--mcp-config",
  "--session-id",
  "--resume",
]);

export function claudeArgs(
  input: Pick<
    LaunchInput,
    "model" | "permissionFlag" | "extraArgs" | "sessionId" | "resume" | "systemPromptFile" | "hook" | "allow"
  >,
): string[] {
  const refused = input.extraArgs.find(
    (a) => RESERVED_ARGS.has(a.split("=")[0] ?? a) || a.includes("bypassPermissions"),
  );
  if (refused) throw new KiboError("INVALID_INPUT", `argument ${refused} is reserved to Kibo`);
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    ...(input.permissionFlag ? ["--permission-mode", input.permissionFlag] : []),
    "--permission-prompts",
    "none",
    "--model",
    input.model,
    "--settings",
    claudeSettings(input.hook, input.allow),
    "--mcp-config",
    mcpServerConfig(input.hook),
    "--append-system-prompt-file",
    input.systemPromptFile,
    ...input.extraArgs,
    ...(input.resume ? ["--resume", input.sessionId] : ["--session-id", input.sessionId]),
  ];
}

const dropped = (key: string) =>
  (key.startsWith("CLAUDE") && key !== "CLAUDE_CONFIG_DIR") ||
  key.startsWith("KIBO_HOOK_") ||
  key === "KIBO_RUN_TOKEN";

export function cleanEnv(base: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !dropped(key)) env[key] = value;
  }
  return env;
}

export function childEnv(
  base: Record<string, string | undefined>,
  extra: { hookUrl: string; token: string; env?: Record<string, string> },
): Record<string, string> {
  return {
    ...cleanEnv(base),
    ...cleanEnv(extra.env ?? {}),
    KIBO_HOOK_URL: extra.hookUrl,
    KIBO_RUN_TOKEN: extra.token,
  };
}

export function parseHelp(text: string): CliCaps {
  const block = /--permission-mode[\s\S]*?\(choices:([^)]*)\)/.exec(text)?.[1] ?? "";
  return { permissionModes: [...block.matchAll(/"([^"]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : [])) };
}

export async function readCliCaps(claudeBin: string, env: Record<string, string>): Promise<CliCaps> {
  const proc = Bun.spawn([claudeBin, "--help"], { env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), 5000);
  const [text, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  clearTimeout(timer);
  if (code !== 0) throw new KiboError("AGENT_CLI_NOT_FOUND", `${claudeBin} --help exited with ${code}`);
  return parseHelp(text);
}

export function permissionFlag(mode: PermissionMode, caps: CliCaps): string | null {
  const known = caps.permissionModes;
  if (known.length === 0) return mode === "default" ? null : mode;
  if (known.includes(mode)) return mode;
  if (mode === "default" && known.includes("manual")) return "manual";
  throw new KiboError("INVALID_INPUT", `the installed claude CLI does not accept --permission-mode ${mode}`);
}

export const KILL_GRACE_MS = 5000;

export function killGroup(pid: number, graceMs = KILL_GRACE_MS): void {
  if (!signalGroup(pid, "SIGTERM")) return;
  const escalate = setTimeout(() => {
    try {
      if (signalGroup(pid, 0)) signalGroup(pid, "SIGKILL");
    } catch (e) {
      console.error(`[kibo-daemon] cannot kill process group ${pid}`, e);
    }
  }, graceMs);
  escalate.unref();
}

export const readPs: PsReader = (pid) => {
  const res = Bun.spawnSync(["ps", "-o", "args=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
  return res.exitCode === 0 ? res.stdout.toString() : null;
};

export function reapOrphan(pid: number, sessionId: string, ps: PsReader = readPs): boolean {
  const args = ps(pid);
  if (!args?.includes(sessionId)) return false;
  killGroup(pid);
  return true;
}

const ResultLine = z.object({
  type: z.literal("result"),
  is_error: z.boolean(),
  result: z.string().optional(),
  total_cost_usd: z.number().optional(),
  usage: Usage.optional(),
  permission_denials: z.array(z.object({ tool_name: z.string().optional() })).optional(),
});

export function parseResultLine(line: string): StreamResult | null {
  const parsed = ResultLine.safeParse(parseJsonLine(line));
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    isError: r.is_error,
    result: r.result ?? null,
    tokens: usageTokens(r.usage),
    costUsd: r.total_cost_usd ?? 0,
    denied: (r.permission_denials ?? []).map((d) => d.tool_name ?? "?"),
    raw: line,
  };
}

async function* lines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
      yield buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer.length > 0) yield buffer;
}

async function tail(stream: ReadableStream<Uint8Array>, max = 4000): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of stream) text = (text + decoder.decode(chunk, { stream: true })).slice(-max);
  return text;
}

export function launch(input: LaunchInput): RunProcess {
  const proc = Bun.spawn([input.claudeBin, ...claudeArgs(input)], {
    cwd: input.cwd,
    env: childEnv(input.baseEnv, {
      hookUrl: input.hookUrl,
      token: input.token,
      env: input.extraEnv,
    }),
    stdin: new Blob([input.prompt]),
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  const readResult = async () => {
    let result: StreamResult | null = null;
    for await (const line of lines(proc.stdout)) result = parseResultLine(line) ?? result;
    return result;
  };
  const exited = Promise.all([readResult(), tail(proc.stderr), proc.exited]).then(
    ([result, stderrTail, code]) => ({
      code,
      result,
      stderrTail,
    }),
  );
  return { pid: proc.pid, kill: () => killGroup(proc.pid), exited };
}

export function resolveClaudeBin(
  configured: string | null,
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
): string {
  if (configured) return configured;
  const extra = [
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const found = Bun.which("claude", { PATH: [env.PATH ?? "", ...extra].filter(Boolean).join(":") });
  if (!found) throw new KiboError("AGENT_CLI_NOT_FOUND", "claude CLI not found in PATH");
  return found;
}
