import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assistantArgs,
  CLAUDE_BUILTIN_TOOLS,
  type ClaudeProbe,
  createAiAvailability,
  generatorArgs,
  parseAuthStatus,
  parseHelp,
  parseVersion,
  probeClaude,
} from "./claude-cli";
import type { Exec } from "./ports";

const help = (name: string) =>
  readFileSync(join(import.meta.dir, "..", "agents", "scenarios", "help", name), "utf8");
const current = parseHelp(help("claude-2.1.283.txt"));
const legacy = parseHelp(help("legacy.txt"));

describe("parseHelp", () => {
  test("detects every option of claude 2.1.283", () => {
    expect(current).toEqual({ tools: true, jsonSchema: true, strictMcp: true, noSessionPersistence: true });
  });
  test("does not mistake an option quoted in a description for an option", () => {
    expect(
      parseHelp("  --include-hook-events   x\n                          --tools in a sentence)\n").tools,
    ).toBe(false);
  });
  test("detects an older CLI without --tools nor --json-schema", () => {
    expect(legacy).toEqual({
      tools: false,
      jsonSchema: false,
      strictMcp: false,
      noSessionPersistence: false,
    });
  });
});

test("parseVersion and parseAuthStatus", () => {
  expect(parseVersion("2.1.283 (Claude Code)\n")).toBe("2.1.283");
  expect(parseVersion("garbage")).toBeNull();
  expect(parseAuthStatus('{"loggedIn":true,"authMethod":"claude.ai","email":"x@y"}')).toBe(true);
  expect(parseAuthStatus('{"loggedIn":false}')).toBe(false);
  expect(parseAuthStatus("error: unknown command 'auth'")).toBeNull();
});

describe("assistantArgs", () => {
  test("disables every tool and asks for structured JSON on a current CLI", () => {
    expect(assistantArgs(current, "{}")).toEqual([
      "--tools",
      "",
      "--json-schema",
      "{}",
      "--strict-mcp-config",
      "--no-session-persistence",
    ]);
  });
  test("falls back to --disallowedTools on an older CLI", () => {
    expect(assistantArgs(legacy, "{}")).toEqual(["--disallowedTools", CLAUDE_BUILTIN_TOOLS.join(",")]);
  });
});

describe("generatorArgs", () => {
  test("limits tools, pre-approves only the test command and forbids the web", () => {
    expect(generatorArgs(current)).toEqual([
      "--tools",
      "Read,Edit,Write,Glob,Grep,Bash",
      "--allowedTools",
      "Bash(kibo component test:*)",
      "--disallowedTools",
      "WebFetch,WebSearch",
      "--strict-mcp-config",
    ]);
  });
  test("denies every other built-in tool on an older CLI", () => {
    const args = generatorArgs(legacy);
    const denied = args[args.indexOf("--disallowedTools") + 1]?.split(",") ?? [];
    expect(denied).toContain("WebFetch");
    expect(denied).toContain("Task");
    expect(denied).not.toContain("Write");
  });
  test("never uses an option reserved to the phase 2 runner", () => {
    const reserved = [
      "--permission-mode",
      "--permission-prompts",
      "--output-format",
      "--settings",
      "--mcp-config",
      "--resume",
      "--session-id",
    ];
    for (const args of [
      generatorArgs(current),
      assistantArgs(current, "{}"),
      generatorArgs(legacy),
      assistantArgs(legacy, "{}"),
    ]) {
      expect(args.join(" ")).not.toContain("dangerously");
      expect(args.join(" ")).not.toContain("bypassPermissions");
      for (const r of reserved) expect(args).not.toContain(r);
    }
  });
});

describe("probeClaude", () => {
  const exec =
    (answers: Record<string, { code: number; stdout: string } | null>): Exec =>
    async (argv) => {
      const a = answers[argv.slice(1).join(" ")];
      return a === undefined || a === null ? null : { ...a, stderr: "" };
    };
  test("reports a missing binary", async () => {
    expect(await probeClaude(exec({}), "claude")).toEqual({
      found: false,
      version: null,
      loggedIn: null,
      capabilities: null,
    });
  });
  test("reads version, capabilities and login", async () => {
    const probe = await probeClaude(
      exec({
        "--version": { code: 0, stdout: "2.1.283 (Claude Code)" },
        "--help": { code: 0, stdout: help("claude-2.1.283.txt") },
        "auth status --json": { code: 0, stdout: '{"loggedIn":true}' },
      }),
      "claude",
    );
    expect(probe).toMatchObject({ found: true, version: "2.1.283", loggedIn: true });
    expect(probe.capabilities?.tools).toBe(true);
  });
  test("falls back when help fails and auth status is unknown", async () => {
    const probe = await probeClaude(
      exec({
        "--version": { code: 0, stdout: "2.1.283 (Claude Code)" },
        "--help": { code: 1, stdout: help("claude-2.1.283.txt") },
        "auth status --json": { code: 1, stdout: "error: unknown command 'auth'" },
      }),
      "claude",
    );
    expect(probe).toEqual({ found: true, version: "2.1.283", loggedIn: null, capabilities: legacy });
  });
  test("a binary failing on --version is reported missing", async () => {
    expect((await probeClaude(exec({ "--version": { code: 127, stdout: "" } }), "claude")).found).toBe(false);
  });
});

describe("createAiAvailability", () => {
  const found = { found: true, version: "2.1.283", loggedIn: true, capabilities: current };
  test("is unavailable before the first probe", () => {
    const ai = createAiAvailability({ probe: async () => found, profileEnabled: () => true });
    expect(ai.status()).toMatchObject({ available: false, reason: "missing" });
  });
  test("reflects the probe and the profiles", async () => {
    const ai = createAiAvailability({ probe: async () => found, profileEnabled: (id) => id === "assistant" });
    expect(await ai.refresh()).toEqual({
      available: true,
      reason: null,
      version: "2.1.283",
      loggedIn: true,
      profiles: { assistant: true, generateur: false },
    });
    expect(ai.capabilities()).toEqual(current);
  });
  test("a logged-out claude is unavailable, an unknown login is available", async () => {
    const out = createAiAvailability({
      probe: async () => ({ ...found, loggedIn: false }),
      profileEnabled: () => true,
    });
    expect(await out.refresh()).toMatchObject({ available: false, reason: "logged_out" });
    const unknown = createAiAvailability({
      probe: async () => ({ ...found, loggedIn: null }),
      profileEnabled: () => true,
    });
    expect(await unknown.refresh()).toMatchObject({ available: true, loggedIn: null });
  });
  test("settled waits for the detection in progress, then answers at once", async () => {
    let answer = (_: ClaudeProbe) => {};
    const ai = createAiAvailability({
      probe: () =>
        new Promise<ClaudeProbe>((resolve) => {
          answer = resolve;
        }),
      profileEnabled: () => true,
    });
    const detection = ai.refresh();
    const settled = ai.settled();
    expect(ai.status()).toMatchObject({ available: false });
    answer(found);
    expect(await settled).toMatchObject({ available: true, version: "2.1.283" });
    await detection;
    expect(await ai.settled()).toMatchObject({ available: true });
  });
  test("a failed detection is reported by settled, then forgotten", async () => {
    const ai = createAiAvailability({
      probe: async () => {
        throw new Error("probe crashed");
      },
      profileEnabled: () => true,
    });
    const detection = ai.refresh();
    await expect(ai.settled()).rejects.toThrow("probe crashed");
    await expect(detection).rejects.toThrow("probe crashed");
    expect(await ai.settled()).toMatchObject({ available: false, reason: "missing" });
  });
});
