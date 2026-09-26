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

export function mcpServerConfig(launcher: HookLauncher): string {
  return JSON.stringify({
    mcpServers: { kibo: { command: launcher.command, args: [...launcher.args, "mcp"] } },
  });
}
