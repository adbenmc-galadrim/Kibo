import { homedir } from "node:os";
import { join } from "node:path";
import {
  AllowRules,
  ASK_TOOLS,
  HookEventName,
  KiboError,
  type PermissionMode,
  PROJECT_AGENT_MCP_TOOLS,
  TICKET_MCP_TOOLS,
} from "@kibo/schema";
import { z } from "zod";
import { signalGroup, tryKill } from "../process-group";
import type { McpTools } from "./ask-mcp";
import { childEnv } from "./child-env";
import { type HookLauncher, hookShellCommand, mcpServerConfig } from "./hook-launcher";
import { parseJsonLine, Usage, usageTokens } from "./transcript";

export { childEnv, cleanEnv } from "./child-env";

export type LaunchInput = {
  claudeBin: string;
  cwd: string;
  model: string;
  permissionFlag: string | null;
  extraArgs: string[];
  sessionId: string;
  resume: boolean;
  prompt: string;
  systemPromptFile: string;
  hook: HookLauncher;
  allow: readonly string[];
  deny: readonly string[];
  mcpUrl: string | null;
  mcpConfigFile: string | null;
  mcpTools: McpTools;
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

const isKiboTool = (rule: string) =>
  TICKET_MCP_TOOLS.includes(rule) || PROJECT_AGENT_MCP_TOOLS.includes(rule);

function profileRules(allow: readonly string[]): string[] {
  const rules = AllowRules.safeParse(allow.filter((rule) => !isKiboTool(rule)));
  if (!rules.success)
    throw new KiboError("INVALID_INPUT", "the profile carries an unsafe or malformed permission rule");
  const kiboTools = allow.filter((rule) => PROJECT_AGENT_MCP_TOOLS.includes(rule));
  return [...new Set([...kiboTools, ...rules.data])];
}

const baseTools = (tools: McpTools): readonly string[] => (tools === "ticket" ? TICKET_MCP_TOOLS : ASK_TOOLS);

export function claudeSettings(
  hook: HookLauncher,
  allow: readonly string[] = [],
  deny: readonly string[] = [],
  tools: McpTools = null,
): string {
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
  const permissions = {
    allow: [...baseTools(tools), ...rules],
    ...(deny.length > 0 ? { deny: [...deny] } : {}),
  };
  return JSON.stringify({ hooks, permissions });
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
    | "model"
    | "permissionFlag"
    | "extraArgs"
    | "sessionId"
    | "resume"
    | "systemPromptFile"
    | "hook"
    | "allow"
    | "deny"
    | "mcpConfigFile"
    | "mcpTools"
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
    claudeSettings(input.hook, input.allow, input.deny, input.mcpTools),
    "--mcp-config",
    input.mcpConfigFile ?? mcpServerConfig(input.hook),
    "--append-system-prompt-file",
    input.systemPromptFile,
    ...input.extraArgs,
    ...(input.resume ? ["--resume", input.sessionId] : ["--session-id", input.sessionId]),
  ];
}

export function parseHelp(text: string): CliCaps {
  const block = /--permission-mode[\s\S]*?\(choices:([^)]*)\)/.exec(text)?.[1] ?? "";
  return { permissionModes: [...block.matchAll(/"([^"]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : [])) };
}

export async function readCliCaps(claudeBin: string, env: Record<string, string>): Promise<CliCaps> {
  const proc = Bun.spawn([claudeBin, "--help"], { env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => tryKill(`stopping ${claudeBin} --help`, () => proc.kill()), 5000);
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
  const escalate = setTimeout(
    () => tryKill(`killing process group ${pid}`, () => signalGroup(pid, 0) && signalGroup(pid, "SIGKILL")),
    graceMs,
  );
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
      mcpUrl: input.mcpUrl,
      mcpTools: input.mcpTools,
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
