import type { McpServerInput } from "@kibo/schema";
import { FAKE_MCP_STDIO } from "../testing/fake-mcp";

export function stubbornServer(id: string, marker: string): McpServerInput {
  return {
    transport: "stdio",
    id,
    name: "Stubborn",
    command: "/bin/sh",
    args: ["-c", `trap '' TERM; "$0" "$1" ${marker}; true`, process.execPath, FAKE_MCP_STDIO],
    envNames: [],
  };
}

export function pidsMatching(marker: string): number[] {
  const out = Bun.spawnSync(["pgrep", "-f", marker]).stdout.toString();
  return out
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(Number);
}

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function survivors(pids: number[], withinMs = 2_000): Promise<number[]> {
  const deadline = Date.now() + withinMs;
  while (pids.some(alive) && Date.now() < deadline) await Bun.sleep(20);
  return pids.filter(alive);
}
