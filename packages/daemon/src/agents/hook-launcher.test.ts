import { expect, test } from "bun:test";
import { defaultHookLauncher, hookShellCommand, mcpServerConfig } from "./hook-launcher";

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
