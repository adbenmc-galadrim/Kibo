import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { cleanFakeDirs, finish, readHooks, start, tmp } from "./fake-claude.test-helper";
import { fakeLaunch } from "./fake-claude-launch";
import { FakeScenario } from "./fake-claude-scenario";

cleanFakeDirs();

const EVENTS = [
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "SessionEnd",
];
const deny = (reason: string) =>
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });

function guardSettings(log: string): string {
  const record = `input=$(cat); printf '%s\\n' "$input" >> '${log}'`;
  const guard =
    `case "$input" in *'"skill":"deploy"'*) echo '${deny("skill non autorisé par Kibo : deploy")}';; ` +
    `*'"subagent_type":"seo"'*) echo '${deny("sous-agent non autorisé par Kibo : seo")}';; esac`;
  const hooks = Object.fromEntries(
    EVENTS.map((event) => [
      event,
      [
        {
          ...(event.endsWith("ToolUse") ? { matcher: "*" } : {}),
          hooks: [{ type: "command", command: event === "PreToolUse" ? `${record}; ${guard}` : record }],
        },
      ],
    ]),
  );
  return JSON.stringify({ hooks });
}

function scenario(dir: string, steps: unknown[]): string {
  const file = join(dir, "scenario.json");
  writeFileSync(file, JSON.stringify(FakeScenario.parse({ turns: [{ steps, result: "Fini." }] })));
  return file;
}

const Block = z
  .object({
    type: z.string(),
    id: z.string().optional(),
    name: z.string().optional(),
    tool_use_id: z.string().optional(),
    text: z.string().optional(),
  })
  .passthrough();
const Line = z.object({
  isSidechain: z.boolean(),
  message: z.object({ content: z.union([z.string(), z.array(Block)]) }),
});
type Line = z.infer<typeof Line>;
const transcript = (state: string, sid: string): Line[] =>
  readFileSync(join(state, `${sid}.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((l) => Line.parse(JSON.parse(l)));
const blocks = (lines: Line[]) =>
  lines.flatMap((l) =>
    typeof l.message.content === "string"
      ? []
      : l.message.content.map((b) => ({ ...b, sidechain: l.isSidechain })),
  );

async function play(steps: unknown[], args: string[] = []) {
  const state = tmp();
  const log = join(state, "hooks.jsonl");
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, steps), KIBO_FAKE_CLAUDE_STATE: state };
  const run = await finish(start(["--session-id", "s1", "--settings", guardSettings(log), ...args], env));
  return { state, run, hooks: () => readHooks(log) };
}

test("the launch flags are recorded: agents, tools, model, name and prompt snapshot", async () => {
  const state = tmp();
  const agents = join(state, "agents.json");
  writeFileSync(
    agents,
    JSON.stringify({ review: { description: "Relit le code", prompt: "Tu relis.", tools: ["Read"] } }),
  );
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, []), KIBO_FAKE_CLAUDE_STATE: state };
  const args = [
    "--session-id",
    "s1",
    "--agents",
    agents,
    "--tools",
    "Read,Skill",
    "--disallowedTools",
    "Bash",
    "--model",
    "opus",
    "--name",
    "kib · livraison · KIB-14",
    "--system-prompt-snapshot",
    "off",
  ];
  expect((await finish(start(args, env))).code).toBe(0);
  expect(fakeLaunch(state, "s1")).toEqual({
    agents: { review: { description: "Relit le code", prompt: "Tu relis.", tools: ["Read"] } },
    tools: ["Read", "Skill"],
    disallowedTools: ["Bash"],
    model: "opus",
    name: "kib · livraison · KIB-14",
    systemPromptSnapshot: "off",
  });
});

test("a launch without flags records nulls", async () => {
  const { state, run } = await play([]);
  expect(run.code).toBe(0);
  expect(fakeLaunch(state, "s1")).toEqual({
    agents: null,
    tools: null,
    disallowedTools: null,
    model: null,
    name: null,
    systemPromptSnapshot: null,
  });
});

test("an invalid agents file stops the launch", async () => {
  for (const content of ["{ pas du json", JSON.stringify({ review: { description: "x" } }), "[]"]) {
    const state = tmp();
    const agents = join(state, "agents.json");
    writeFileSync(agents, content);
    const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, []), KIBO_FAKE_CLAUDE_STATE: state };
    const run = await finish(start(["--session-id", "s1", "--agents", agents], env));
    expect(run.code).toBe(1);
    expect(run.err).toContain("invalid agents");
  }
});

test("a skill step writes a Skill tool use and runs both tool hooks with its tool use id", async () => {
  const { state, run, hooks } = await play([{ skill: "brainstorming", args: "formulaire" }]);
  expect(run.code).toBe(0);
  const [use, result] = blocks(transcript(state, "s1"));
  expect(use).toMatchObject({
    type: "tool_use",
    name: "Skill",
    input: { skill: "brainstorming", args: "formulaire" },
  });
  expect(result).toMatchObject({
    type: "tool_result",
    tool_use_id: use?.id,
    content: "Launching skill: brainstorming",
  });
  const tool = hooks().filter((h) => h.tool_name === "Skill");
  expect(tool.map((h) => [h.hook_event_name, h.tool_use_id])).toEqual([
    ["PreToolUse", use?.id],
    ["PostToolUse", use?.id],
  ]);
  expect(tool[0]?.tool_input).toEqual({ skill: "brainstorming", args: "formulaire" });
});

test("a skill denied by the hook gets an error result and no PostToolUse", async () => {
  const { state, run, hooks } = await play([{ skill: "deploy" }]);
  const [use, result] = blocks(transcript(state, "s1"));
  expect(result).toMatchObject({
    tool_use_id: use?.id,
    is_error: true,
    content: "Permission to use Skill has been denied. skill non autorisé par Kibo : deploy",
  });
  expect(
    hooks()
      .filter((h) => h.tool_name === "Skill")
      .map((h) => h.hook_event_name),
  ).toEqual(["PreToolUse"]);
  expect(run.lines.at(-1)).toMatchObject({ permission_denials: [{ tool_name: "Skill" }] });
});

test("a skill marked denied is refused even when the hooks allow it", async () => {
  const { state } = await play([{ skill: "brainstorming", denied: true }]);
  expect(blocks(transcript(state, "s1"))[1]).toMatchObject({ is_error: true });
});

test("a subagent step plays its steps in a sidechain between SubagentStart and SubagentStop", async () => {
  const { state, run, hooks } = await play([
    { subagent: "review", steps: [{ say: "Je relis." }, { skill: "brainstorming" }] },
  ]);
  expect(run.code).toBe(0);
  const all = blocks(transcript(state, "s1"));
  const agent = all[0];
  expect(agent).toMatchObject({
    type: "tool_use",
    name: "Agent",
    input: { subagent_type: "review" },
    sidechain: false,
  });
  expect(all.slice(1, 4).map((b) => [b.type, b.sidechain])).toEqual([
    ["text", true],
    ["tool_use", true],
    ["tool_result", true],
  ]);
  expect(all.find((b) => b.type === "tool_result" && b.tool_use_id === agent?.id)).toMatchObject({
    content: "Sous-agent review terminé.",
    sidechain: false,
  });
  const events = hooks().map((h) => [h.hook_event_name, h.tool_name ?? h.agent_type ?? null]);
  expect(events.slice(1, -2)).toEqual([
    ["PreToolUse", "Agent"],
    ["SubagentStart", "review"],
    ["PreToolUse", "Skill"],
    ["PostToolUse", "Skill"],
    ["SubagentStop", "review"],
    ["PostToolUse", "Agent"],
  ]);
  const start = hooks().find((h) => h.hook_event_name === "SubagentStart");
  const stop = hooks().find((h) => h.hook_event_name === "SubagentStop");
  expect(start?.agent_id).toEqual(expect.any(String));
  expect(stop?.agent_id).toBe(start?.agent_id);
});

test("a subagent denied by the hook gets an error result and its steps are not played", async () => {
  const { state, hooks } = await play([{ subagent: "seo", steps: [{ say: "Jamais." }] }]);
  const all = blocks(transcript(state, "s1"));
  expect(all[1]).toMatchObject({
    is_error: true,
    content: "Permission to use Agent has been denied. sous-agent non autorisé par Kibo : seo",
  });
  expect(all.some((b) => b.text === "Jamais.")).toBe(false);
  expect(hooks().some((h) => h.hook_event_name === "SubagentStart")).toBe(false);
});

test("a hook step carries a tool use id shared by its Pre and Post hooks", async () => {
  const { hooks } = await play([
    { hook: "PreToolUse", tool: "Read", input: { file_path: "a.ts" } },
    { hook: "PostToolUse", tool: "Read", input: { file_path: "a.ts" } },
  ]);
  const read = hooks().filter((h) => h.tool_name === "Read");
  expect(read[0]?.tool_use_id).toEqual(expect.stringMatching(/^toolu_/));
  expect(read[1]?.tool_use_id).toBe(read[0]?.tool_use_id);
});
