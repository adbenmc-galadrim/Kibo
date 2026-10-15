import { expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, finish, readHooks, start, tmp } from "./fake-claude.test-helper";
import { FakeScenario, releaseFakeRun, scenarioPath } from "./fake-claude-scenario";

cleanFakeDirs();

const EVENTS = ["PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop"];
const settings = (log: string) =>
  JSON.stringify({
    hooks: Object.fromEntries(
      EVENTS.map((e) => [
        e,
        [
          {
            ...(e.endsWith("ToolUse") ? { matcher: "*" } : {}),
            hooks: [{ type: "command", command: `cat >> '${log}'; echo >> '${log}'` }],
          },
        ],
      ]),
    ),
  });

const REVIEW = {
  subagent: {
    type: "ecc:code-reviewer",
    description: "Porte qualité",
    prompt: "Relis le diff",
    actions: [{ bash: "git diff" }],
    result: "RAS",
  },
};

const jsonLines = (path: string) =>
  readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Record<string, unknown>);
const contentOf = (line: Record<string, unknown>): Record<string, unknown>[] => {
  const content = Reflect.get(Object(line.message), "content");
  return Array.isArray(content) ? content : [];
};

function launch(steps: unknown[]) {
  const state = tmp();
  const log = join(state, "hooks.jsonl");
  const file = join(state, "scenario.json");
  writeFileSync(file, JSON.stringify(FakeScenario.parse({ turns: [{ steps, result: "Fini." }] })));
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: file, KIBO_FAKE_CLAUDE_STATE: state };
  const proc = start(["--session-id", "s1", "--settings", settings(log)], env);
  return { state, proc, hooks: () => readHooks(log) };
}

test("a subagent step writes its transcript and meta beside the session, between its hooks", async () => {
  const { state, proc, hooks } = launch([REVIEW]);
  expect((await finish(proc)).code).toBe(0);
  const main = jsonLines(join(state, "s1.jsonl")).flatMap(contentOf);
  const use = main.find((b) => b.type === "tool_use" && b.name === "Agent");
  expect(use?.input).toEqual({
    subagent_type: "ecc:code-reviewer",
    description: "Porte qualité",
    prompt: "Relis le diff",
  });
  expect(main.find((b) => b.type === "tool_result" && b.tool_use_id === use?.id)?.content).toBe("RAS");
  const events = hooks().map((h) => h.hook_event_name);
  expect(events).toEqual(["PreToolUse", "SubagentStart", "PostToolUse", "SubagentStop", "PostToolUse"]);
  const agentId = String(hooks()[1]?.agent_id);
  expect(hooks()[2]).toMatchObject({
    agent_id: agentId,
    tool_name: "Bash",
    tool_input: { command: "git diff" },
  });
  const dir = join(state, "s1", "subagents");
  expect(JSON.parse(readFileSync(join(dir, `agent-${agentId}.meta.json`), "utf8"))).toMatchObject({
    agentType: "ecc:code-reviewer",
    description: "Porte qualité",
    toolUseId: use?.id,
    spawnDepth: 1,
  });
  const own = jsonLines(join(dir, `agent-${agentId}.jsonl`));
  expect(own.every((l) => l.isSidechain === true && l.agentId === agentId)).toBe(true);
  expect(own.flatMap(contentOf).map((b) => b.type)).toEqual(["tool_use", "tool_result", "text"]);
  expect(hooks()[3]?.last_assistant_message).toBe("RAS");
});

test("a held subagent says its progress, then waits for its release between start and stop", async () => {
  const progress = "Je relis les tests.";
  const { state, proc, hooks } = launch([{ subagent: { ...REVIEW.subagent, progress, hold: true } }]);
  const started = () =>
    existsSync(join(state, "hooks.jsonl")) && hooks().some((h) => h.hook_event_name === "SubagentStart");
  while (!started()) await Bun.sleep(20);
  await Bun.sleep(100);
  expect(hooks().some((h) => h.hook_event_name === "SubagentStop")).toBe(false);
  const agentId = String(hooks().find((h) => h.hook_event_name === "SubagentStart")?.agent_id);
  const own = readFileSync(join(state, "s1", "subagents", `agent-${agentId}.jsonl`), "utf8");
  expect(own).toContain(progress);
  releaseFakeRun(state, "s1");
  expect((await finish(proc)).code).toBe(0);
  expect(hooks().some((h) => h.hook_event_name === "SubagentStop")).toBe(true);
});

test("the delivery-subagents scenario parses", () => {
  const parsed = FakeScenario.parse(JSON.parse(readFileSync(scenarioPath("delivery-subagents"), "utf8")));
  const types = parsed.turns
    .flatMap((t) => t.steps)
    .flatMap((s) => ("subagent" in s && typeof s.subagent === "object" ? [s.subagent.type] : []));
  expect(types).toEqual(["Explore", "ecc:code-reviewer"]);
});

test("a failed subagent ends with an error result in the main transcript", async () => {
  const { state, proc } = launch([
    { subagent: { ...REVIEW.subagent, result: "Diff illisible", failed: true } },
  ]);
  expect((await finish(proc)).code).toBe(0);
  const main = jsonLines(join(state, "s1.jsonl")).flatMap(contentOf);
  const use = main.find((b) => b.type === "tool_use" && b.name === "Agent");
  expect(main.find((b) => b.type === "tool_result" && b.tool_use_id === use?.id)).toMatchObject({
    content: "Diff illisible",
    is_error: true,
  });
});

test("the delivery-review scenario has a failed subagent", () => {
  const parsed = FakeScenario.parse(JSON.parse(readFileSync(scenarioPath("delivery-review"), "utf8")));
  const failed = parsed.turns
    .flatMap((t) => t.steps)
    .flatMap((s) =>
      "subagent" in s && typeof s.subagent === "object" && s.subagent.failed ? [s.subagent] : [],
    );
  expect(failed.map((s) => s.description)).toEqual(["Porte qualité — conventions"]);
});
