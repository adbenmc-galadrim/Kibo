import { homedir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { isClaudeIsolated } from "../agent-files/claude-home";
import { signalGroup, tryKill } from "../process-group";
import type { McpTools } from "./ask-mcp";
import { childEnv } from "./child-env";
import { claudeArgs } from "./claude-args";
import type { AgentFlags } from "./cli-flags";
import type { HookLauncher } from "./hook-launcher";
import { parseJsonLine, Usage, usageTokens } from "./transcript";

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
  agentFlags: AgentFlags;
};
export type StreamResult = {
  isError: boolean;
  result: string | null;
  tokens: number;
  costUsd: number;
  denied: string[];
  raw: string;
};
export type PsReader = (pid: number) => string | null;
export type ProcessOutcome = { code: number; result: StreamResult | null; stderrTail: string };
export type RunProcess = { pid: number; kill(): void; exited: Promise<ProcessOutcome> };

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

const deniedToolName = (name: string | undefined): string => (name === "Task" ? "Agent" : (name ?? "?"));

export function parseResultLine(line: string): StreamResult | null {
  const parsed = ResultLine.safeParse(parseJsonLine(line));
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    isError: r.is_error,
    result: r.result ?? null,
    tokens: usageTokens(r.usage),
    costUsd: r.total_cost_usd ?? 0,
    denied: (r.permission_denials ?? []).map((d) => deniedToolName(d.tool_name)),
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

export function launchArgs(input: LaunchInput): string[] {
  return claudeArgs({ ...input, isolated: isClaudeIsolated(input.baseEnv) });
}

export function launch(input: LaunchInput): RunProcess {
  const proc = Bun.spawn([input.claudeBin, ...launchArgs(input)], {
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
