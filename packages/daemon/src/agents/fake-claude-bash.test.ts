import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, finish, readHooks, settings, start, tmp } from "./fake-claude.test-helper";

cleanFakeDirs();

test("a bash step runs the command, finds kibo through KIBO_CLI and reports its output", async () => {
  const dir = tmp();
  const cli = join(dir, "cli.ts");
  writeFileSync(
    cli,
    `await Bun.write("${join(dir, "args.json")}", JSON.stringify(process.argv.slice(2)));\nconsole.log("✓ EMIS-15 : 4 · Worktree");\n`,
  );
  const scenario = join(dir, "scenario.json");
  const steps = [{ bash: 'kibo tickets step EMIS-15 4 "worktree"' }, { bash: "echo done >&2; exit 3" }];
  writeFileSync(scenario, JSON.stringify({ turns: [{ steps, result: "fini" }] }));
  const log = join(dir, "hooks.jsonl");
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario, KIBO_FAKE_CLAUDE_STATE: dir, KIBO_CLI: cli };
  const { code } = await finish(start(["--session-id", "s1", "--settings", settings(log)], env));
  expect(code).toBe(0);
  expect(JSON.parse(readFileSync(join(dir, "args.json"), "utf8"))).toEqual([
    "tickets",
    "step",
    "EMIS-15",
    "4",
    "worktree",
  ]);
  const posts = readHooks(log).filter((h) => h.hook_event_name === "PostToolUse" && h.tool_name === "Bash");
  expect(posts.map((h) => h.tool_input)).toEqual([
    { command: 'kibo tickets step EMIS-15 4 "worktree"' },
    { command: "echo done >&2; exit 3" },
  ]);
  expect(posts.map((h) => h.tool_response)).toEqual([
    { stdout: "✓ EMIS-15 : 4 · Worktree\n", stderr: "", interrupted: false, isImage: false },
    { stdout: "", stderr: "done\n", interrupted: false, isImage: false },
  ]);
});
