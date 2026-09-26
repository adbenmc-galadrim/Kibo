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

export function crashyServer(id: string, marker: string): McpServerInput {
  return {
    transport: "stdio",
    id,
    name: "Crashy",
    command: "/bin/sh",
    args: ["-c", `sleep 300 & exec "$0" "$1" ${marker}`, process.execPath, FAKE_MCP_STDIO],
    envNames: [],
  };
}

export function groupMembers(pgid: number): number[] {
  return lines(Bun.spawnSync(["pgrep", "-g", String(pgid)]).stdout.toString());
}

const lines = (out: string) =>
  out
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(Number);

export function pidsMatching(marker: string): number[] {
  return lines(Bun.spawnSync(["pgrep", "-f", marker]).stdout.toString());
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
