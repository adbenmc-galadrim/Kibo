import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, finish, readHooks, tmp } from "./fake-claude.test-helper";
import { fakeContexts, fakeWrites } from "./fake-claude-ai";
import { FAKE_CLAUDE, FakeRoutes, FakeScenario, FakeStep, scenarioPath } from "./fake-claude-scenario";

cleanFakeDirs();

const CONTEXT = "Kibo — recouvrement avec bou · livraison · BOU-12";
const allow = (context: string | null) =>
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      ...(context === null ? {} : { additionalContext: context }),
    },
  });
const deny = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "non",
  },
});

function hookSettings(log: string, preReply: string): string {
  const record = `cat >> '${log}'; echo >> '${log}'`;
  const events = ["SessionStart", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"];
  const hooks = Object.fromEntries(
    events.map((event) => [
      event,
      [
        {
          ...(event.endsWith("ToolUse") ? { matcher: "*" } : {}),
          hooks: [
            {
              type: "command",
              command: event === "PreToolUse" ? `${record}; echo '${preReply}'` : record,
            },
          ],
        },
      ],
    ]),
  );
  return JSON.stringify({ hooks });
}

async function play(steps: unknown[], preReply = allow(null)) {
  const state = tmp();
  const cwd = realpathSync(tmp());
  const log = join(state, "hooks.jsonl");
  writeFileSync(log, "");
  const file = join(state, "scenario.json");
  writeFileSync(file, JSON.stringify(FakeScenario.parse({ turns: [{ steps, result: "Fini." }] })));
  const proc = Bun.spawn(
    [
      FAKE_CLAUDE,
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--session-id",
      "s1",
      "--settings",
      hookSettings(log, preReply),
    ],
    {
      cwd,
      env: { ...process.env, KIBO_FAKE_CLAUDE_SCENARIO: file, KIBO_FAKE_CLAUDE_STATE: state },
      stdin: new TextEncoder().encode("Lis le brief."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const run = await finish(proc);
  const raw = readFileSync(log, "utf8").trim();
  const hooks = raw === "" ? [] : readHooks(log);
  const toolHooks = hooks.filter((h) => h.tool_name !== undefined);
  return { state, cwd, run, toolHooks };
}

const FORMAT = "export function formatDate(d: Date): string {\n  return d.toISOString();\n}\n";

describe("write step with inline content", () => {
  test("writes the content through PreToolUse and PostToolUse", async () => {
    const { cwd, run, toolHooks, state } = await play([{ write: "src/lib/format.ts", content: FORMAT }]);
    expect(run.code).toBe(0);
    expect(readFileSync(join(cwd, "src/lib/format.ts"), "utf8")).toBe(FORMAT);
    expect(toolHooks.map((h) => [h.hook_event_name, h.tool_name])).toEqual([
      ["PreToolUse", "Write"],
      ["PostToolUse", "Write"],
    ]);
    expect(toolHooks[0]?.tool_input).toEqual({ file_path: join(cwd, "src/lib/format.ts"), content: FORMAT });
    expect(fakeWrites(state, "s1")).toEqual([{ write: join(cwd, "src/lib/format.ts") }]);
  });

  test("bypassHooks writes without any hook, like the shell", async () => {
    const { cwd, toolHooks } = await play([
      { write: "src/utils/date.ts", content: FORMAT, bypassHooks: true },
    ]);
    expect(readFileSync(join(cwd, "src/utils/date.ts"), "utf8")).toBe(FORMAT);
    expect(toolHooks).toEqual([]);
  });

  test("a step takes a fixture or a content, never neither", () => {
    expect(FakeStep.parse({ write: "a.ts", content: "x" })).toEqual({
      write: "a.ts",
      content: "x",
      bypassHooks: false,
    });
    expect(FakeStep.safeParse({ write: "a.ts" }).success).toBe(false);
  });
});

describe("delete step", () => {
  test("removes the file through a Bash rm", async () => {
    const { cwd, run, toolHooks, state } = await play([
      { write: "src/utils/date.ts", content: FORMAT, bypassHooks: true },
      { delete: "src/utils/date.ts" },
    ]);
    expect(run.code).toBe(0);
    expect(existsSync(join(cwd, "src/utils/date.ts"))).toBe(false);
    expect(toolHooks.map((h) => [h.hook_event_name, h.tool_name, h.tool_input])).toEqual([
      ["PreToolUse", "Bash", { command: "rm src/utils/date.ts" }],
      ["PostToolUse", "Bash", { command: "rm src/utils/date.ts" }],
    ]);
    expect(fakeWrites(state, "s1")).toContainEqual({ deleted: join(cwd, "src/utils/date.ts") });
  });

  test("bypassHooks deletes without any hook, and a missing file is no error", async () => {
    const { cwd, run, toolHooks } = await play([
      { write: "a.ts", content: "x", bypassHooks: true },
      { delete: "a.ts", bypassHooks: true },
      { delete: "missing.ts" },
    ]);
    expect(run.code).toBe(0);
    expect(existsSync(join(cwd, "a.ts"))).toBe(false);
    expect(toolHooks.map((h) => h.tool_input)).toEqual([
      { command: "rm missing.ts" },
      { command: "rm missing.ts" },
    ]);
  });

  test("a path leaving the working directory fails the turn", async () => {
    const { run, toolHooks } = await play([{ delete: "../x.ts" }]);
    expect(run.code).toBe(1);
    expect(run.err).toContain("path outside cwd");
    expect(toolHooks).toEqual([]);
  });

  test("a denied rm keeps the file", async () => {
    const { cwd } = await play(
      [{ write: "a.ts", content: "x", bypassHooks: true }, { delete: "a.ts" }],
      deny,
    );
    expect(existsSync(join(cwd, "a.ts"))).toBe(true);
  });
});

describe("context journal", () => {
  test("an additionalContext received on PreToolUse is journaled with its tool", async () => {
    const { state, run } = await play(
      [
        { hook: "PreToolUse", tool: "Read", input: { file_path: "a.ts" } },
        { write: "b.ts", content: "x" },
      ],
      allow(CONTEXT),
    );
    expect(run.code).toBe(0);
    const contexts = fakeContexts(state, "s1");
    expect(contexts.map((c) => [c.tool, c.additionalContext])).toEqual([
      ["Read", CONTEXT],
      ["Write", CONTEXT],
    ]);
    expect(contexts.every((c) => typeof c.at === "number")).toBe(true);
  });

  test("no context, no line; a deny keeps its behaviour", async () => {
    const plain = await play([{ hook: "PreToolUse", tool: "Read", input: { file_path: "a.ts" } }]);
    expect(fakeContexts(plain.state, "s1")).toEqual([]);
    const denied = await play([{ write: "b.ts", content: "x" }], deny);
    expect(existsSync(join(denied.cwd, "b.ts"))).toBe(false);
    expect(denied.run.lines.at(-1)).toMatchObject({ permission_denials: [{ tool_name: "Write" }] });
  });
});

describe("overlap scenarios", () => {
  const read = (name: Parameters<typeof scenarioPath>[0]) =>
    FakeScenario.parse(JSON.parse(readFileSync(scenarioPath(name), "utf8")));
  const writes = (name: Parameters<typeof scenarioPath>[0]) =>
    read(name).turns.flatMap((t) => t.steps.flatMap((s) => ("write" in s ? [s] : [])));

  test("every overlap scenario parses and writes inline content", () => {
    for (const name of [
      "overlap-owner",
      "overlap-other",
      "overlap-bash",
      "overlap-keep",
      "overlap-import",
    ] as const) {
      const steps = writes(name);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.every((s) => "content" in s)).toBe(true);
    }
  });

  test("the copy taken by the other run is identical to the owner's file", () => {
    const owner = writes("overlap-owner").find((s) => s.write === "src/lib/format.ts");
    const copy = writes("overlap-other").find((s) => s.write === "src/lib/format.ts");
    expect(owner && "content" in owner ? owner.content : "").toContain("export function formatDate");
    expect(copy).toEqual(owner);
    const other = read("overlap-other").turns[0]?.steps ?? [];
    expect(other.some((s) => "delete" in s && s.delete === "src/utils/date.ts")).toBe(true);
    expect(other.some((s) => "mcp" in s && s.mcp === "peek_work")).toBe(true);
    expect(writes("overlap-bash").every((s) => s.bypassHooks)).toBe(true);
    expect(read("overlap-keep").turns[0]?.onStopBlock).toEqual([{ say: "Je garde ma copie." }]);
    expect(writes("overlap-twin").map((s) => s.write)).toEqual(["src/utils/when.ts"]);
  });

  test("the routes pick a scenario per ticket", () => {
    const routes = FakeRoutes.parse(JSON.parse(readFileSync(scenarioPath("overlap-routes"), "utf8")));
    expect(routes.routes.map((r) => [r.prompt, r.scenario])).toEqual([
      ["# BOU-12", "overlap-owner.json"],
      ["# BOU-13", "overlap-twin.json"],
      ["# BOU-15", "overlap-other.json"],
      ["# BOU-16", "overlap-bash.json"],
      ["# BOU-17", "overlap-keep.json"],
      ["# BOU-18", "overlap-import.json"],
    ]);
    expect(routes).toMatchObject({ fallback: "done.json", perTurn: true });
  });
});
