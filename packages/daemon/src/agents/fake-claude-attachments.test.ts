import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, finish, readHooks, settings, start, tmp } from "./fake-claude.test-helper";
import { fakeToolUses } from "./fake-claude-ai";

cleanFakeDirs();

test("a hook path under $KIBO_DRAFT_ATTACHMENTS is resolved from the run's environment and logged", async () => {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const scenario = join(state, "attachments.json");
  const read = (file_path: string) => ({ hook: "PreToolUse", tool: "Read", input: { file_path } });
  writeFileSync(
    scenario,
    JSON.stringify({
      turns: [
        {
          steps: [
            read("$KIBO_DRAFT_ATTACHMENTS/1-a.png"),
            read("CLAUDE.md"),
            read("x/$KIBO_DRAFT_ATTACHMENTS"),
          ],
        },
      ],
    }),
  );
  const env = {
    KIBO_FAKE_CLAUDE_SCENARIO: scenario,
    KIBO_FAKE_CLAUDE_STATE: state,
    KIBO_DRAFT_ATTACHMENTS: "/h/d.attachments",
  };
  const run = await finish(start(["--session-id", "s9", "--settings", settings(hooks)], env));
  expect(run.code).toBe(0);
  const pre = readHooks(hooks).filter((h) => h.hook_event_name === "PreToolUse");
  expect(pre.map((h) => h.tool_input)).toEqual([
    { file_path: "/h/d.attachments/1-a.png" },
    { file_path: "CLAUDE.md" },
    { file_path: "x/$KIBO_DRAFT_ATTACHMENTS" },
  ]);
  expect(fakeToolUses(state, "s9")).toEqual([
    { tool: "Read", input: { file_path: "/h/d.attachments/1-a.png" }, denied: false },
    { tool: "Read", input: { file_path: "CLAUDE.md" }, denied: false },
    { tool: "Read", input: { file_path: "x/$KIBO_DRAFT_ATTACHMENTS" }, denied: false },
  ]);
});

test("without KIBO_DRAFT_ATTACHMENTS, a step that needs it fails the run", async () => {
  const state = tmp();
  const scenario = join(state, "attachments.json");
  writeFileSync(
    scenario,
    JSON.stringify({
      turns: [
        {
          steps: [
            { hook: "PreToolUse", tool: "Read", input: { file_path: "$KIBO_DRAFT_ATTACHMENTS/1-a.png" } },
          ],
        },
      ],
    }),
  );
  const run = await finish(
    start(["--session-id", "s10"], { KIBO_FAKE_CLAUDE_SCENARIO: scenario, KIBO_FAKE_CLAUDE_STATE: state }),
  );
  expect(run.code).not.toBe(0);
  expect(run.err).toContain("KIBO_DRAFT_ATTACHMENTS");
});
