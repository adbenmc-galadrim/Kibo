import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultHookLauncher, hookShellCommand, mcpServerConfig, writeMcpConfig } from "./hook-launcher";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("in development the hook runs through bun, compiled it is the sibling binary", () => {
  expect(defaultHookLauncher("/usr/local/bin/bun", "/repo/packages/daemon/src/agents")).toEqual({
    command: "/usr/local/bin/bun",
    args: ["/repo/packages/daemon/src/agents/kibo-hook.ts"],
  });
  expect(defaultHookLauncher("/Applications/Kibo.app/Contents/MacOS/kibo-daemon", "/$bunfs/root")).toEqual({
    command: "/Applications/Kibo.app/Contents/MacOS/kibo-hook",
    args: [],
  });
});

test("the shell command quotes every part", () => {
  expect(hookShellCommand({ command: "/Users/a b/bun", args: ["/x/it's.ts"] })).toBe(
    `'/Users/a b/bun' '/x/it'\\''s.ts' 'event'`,
  );
});

test("the MCP config starts the same launcher in mcp mode", () => {
  expect(JSON.parse(mcpServerConfig({ command: "/k/kibo-hook", args: [] }))).toEqual({
    mcpServers: { kibo: { command: "/k/kibo-hook", args: ["mcp"] } },
  });
});

test("a project run MCP config carries the daemon URL and the run token in the server env, private", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-mcp-config-"));
  dirs.push(home);
  const runDir = join(home, "runs", "r1");
  const env = { KIBO_MCP_URL: "http://127.0.0.1:4100/agent-mcp/r1", KIBO_RUN_TOKEN: "a".repeat(64) };
  const file = writeMcpConfig(runDir, { command: "/k/kibo-hook", args: [] }, env);
  expect(file).toBe(join(runDir, "mcp.json"));
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
    mcpServers: { kibo: { command: "/k/kibo-hook", args: ["mcp"], env } },
  });
  expect(statSync(runDir).mode & 0o777).toBe(0o700);
  expect(statSync(file).mode & 0o777).toBe(0o600);
  const next = { ...env, KIBO_RUN_TOKEN: "b".repeat(64) };
  writeMcpConfig(runDir, { command: "/k/kibo-hook", args: [] }, next);
  expect(JSON.parse(readFileSync(file, "utf8")).mcpServers.kibo.env).toEqual(next);
  expect(statSync(file).mode & 0o777).toBe(0o600);
});
