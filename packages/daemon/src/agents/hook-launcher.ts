import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type HookLauncher = { command: string; args: string[] };

export function defaultHookLauncher(execPath = process.execPath, dir = import.meta.dir): HookLauncher {
  if (dir.startsWith("/$bunfs")) return { command: join(dirname(execPath), "kibo-hook"), args: [] };
  return { command: execPath, args: [join(dir, "kibo-hook.ts")] };
}

const quote = (part: string) => `'${part.replaceAll("'", `'\\''`)}'`;

export function hookShellCommand(launcher: HookLauncher): string {
  return [launcher.command, ...launcher.args, "event"].map(quote).join(" ");
}

export type McpServerEnv = { KIBO_MCP_URL: string; KIBO_RUN_TOKEN: string };

export function mcpServerConfig(launcher: HookLauncher, env?: McpServerEnv): string {
  const kibo = { command: launcher.command, args: [...launcher.args, "mcp"] };
  return JSON.stringify({ mcpServers: { kibo: env ? { ...kibo, env } : kibo } });
}

export function writeMcpConfig(runDir: string, launcher: HookLauncher, env: McpServerEnv): string {
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  chmodSync(runDir, 0o700);
  const file = join(runDir, "mcp.json");
  writeFileSync(file, mcpServerConfig(launcher, env), { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}
