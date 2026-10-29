import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Agent, AgentSettings, Skill } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { testAgent } from "./agents-port.test-helper";
import { NO_CLI_FALLBACKS } from "./cli-flags";
import { memoryAgentSource } from "./neutral-agents";
import { createTurnPreparer, type TurnContent } from "./run-prepare";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const runDir = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-prepare-"));
  dirs.push(d);
  return join(d, "run");
};

const skill = (id: string, description: string): Skill => ({
  id,
  source: "user",
  projectId: null,
  plugin: null,
  name: id,
  description,
  path: "",
  file: null,
  problem: null,
  hash: null,
  readOnly: false,
  shadowedBy: null,
  files: [],
  usage: { last: null, runs30d: 0 },
  reviews: { open: 0 },
  modifiedAt: null,
});

const reviewSettings: Partial<AgentSettings> = {
  subagents: ["global:livraison", "global:seo"],
  skills: { mode: "list", ids: ["brainstorming", "superpowers:brainstorming"] },
  allow: ["Bash(git *)"],
};
const reviewPr = (body = "Tu relis.", settings = reviewSettings) =>
  testAgent({
    id: "review-pr",
    name: "review-pr",
    model: "fable",
    tools: ["Read", "Grep"],
    body,
    ...settings,
  });
const livraison = testAgent({ id: "livraison", name: "livraison", model: "opus", body: "Tu livres." });
const seo = testAgent({ id: "seo", name: "seo", body: "Tu optimises." });
const skills = [
  skill("brainstorming", "Explore une idée"),
  skill("superpowers:brainstorming", "Version plugin"),
];

function preparer(agents: Agent[], fallbacks = NO_CLI_FALLBACKS) {
  const source = memoryAgentSource(agents, skills);
  return createTurnPreparer({
    data: { agentOf: source.agentOf, skills: (projectId) => source.skills?.(projectId) ?? [] },
    fallbacks,
  });
}

const run = runView({ id: "r1", profileId: "global:review-pr", label: "global · review-pr · KIB-3" });
const content: TurnContent = { kind: "project", systemPrompt: "# Chef", brief: "[tour 1]" };

test("a turn writes its CLAUDE.md, its brief and agents.json, and returns the flags and name", () => {
  const dir = runDir();
  const turn = preparer([reviewPr(), livraison, seo]).prepare(run, dir, content);
  expect(readFileSync(turn.systemPromptFile, "utf8")).toBe("# Chef");
  expect(readFileSync(turn.briefFile, "utf8")).toBe("[tour 1]");
  expect(turn.brief).toBe("[tour 1]");
  expect(turn.agentsFile).toBe(join(dir, "agents.json"));
  expect(statSync(join(dir, "agents.json")).mode & 0o777).toBe(0o600);
  const json = JSON.parse(readFileSync(join(dir, "agents.json"), "utf8"));
  expect(Object.keys(json)).toEqual(["livraison", "seo"]);
  expect(json.livraison).toEqual({ description: "Agent livraison", prompt: "Tu livres.", model: "opus" });
  expect(turn.flags).toEqual({
    model: "fable",
    tools: ["Read", "Grep"],
    disallowedTools: null,
    allowRules: ["Bash(git *)", "Skill(brainstorming)", "Skill(superpowers:brainstorming)"],
  });
  expect(turn.agentFlags).toMatchObject({
    name: "global · review-pr · KIB-3",
    agents: join(dir, "agents.json"),
    tools: ["Read", "Grep"],
    skillRules: ["Skill(brainstorming)", "Skill(superpowers:brainstorming)"],
  });
  expect(turn.promptTitle).toBeNull();
  expect(turn.guard({ tool: "Skill", input: { skill: "deploy" } })).toMatchObject({ decision: "deny" });
});

test("a missing subagent or main agent fails the turn with AGENT_NOT_FOUND", () => {
  expect(() => preparer([reviewPr(), livraison]).prepare(run, runDir(), content)).toThrow(
    /AGENT_NOT_FOUND.*global:seo/,
  );
  expect(() => preparer([livraison, seo]).prepare(run, runDir(), content)).toThrow("AGENT_NOT_FOUND");
});

test("every skill and no subagent: no Skill rule and no agents.json", () => {
  const dir = runDir();
  const open = reviewPr("Tu relis.", { ...reviewSettings, subagents: [], skills: { mode: "all" } });
  const turn = preparer([open]).prepare(run, dir, content);
  expect(turn.agentsFile).toBeNull();
  expect(turn.agentFlags.agents).toBeNull();
  expect(turn.agentFlags.skillRules).toEqual([]);
  expect(turn.flags.allowRules).toEqual(["Bash(git *)"]);
  expect(existsSync(join(dir, "agents.json"))).toBe(false);
});

test("each turn recomposes from the current files and drops a stale agents.json", () => {
  const dir = runDir();
  const agents = [reviewPr(), livraison, seo];
  const p = preparer(agents);
  p.prepare(run, dir, content);
  agents[0] = reviewPr("Tu relis deux fois.", { ...reviewSettings, subagents: [] });
  const second = p.prepare(run, dir, content);
  expect(second.agentsFile).toBeNull();
  expect(existsSync(join(dir, "agents.json"))).toBe(false);
});

test("Kibo's agents without a file still launch with the default model", () => {
  const system = testAgent({ id: "assistant", name: "kibo-assistant", system: true, file: null });
  const turn = preparer([system]).prepare(
    runView({ id: "r2", profileId: "system:assistant", label: "kibo · kibo-assistant" }),
    runDir(),
    content,
  );
  expect(turn.flags.model).toBe("sonnet");
  const unreadable = testAgent({ id: "casse", name: "casse", file: null });
  expect(() =>
    preparer([unreadable]).prepare(runView({ id: "r3", profileId: "global:casse" }), runDir(), content),
  ).toThrow("INVALID_INPUT");
});

test("fallback: subagents inline, skill rules with arguments, name as the prompt title", () => {
  const dir = runDir();
  const fallbacks = { ...NO_CLI_FALLBACKS, agentsInline: true, skillArgsRule: true, nameInPrompt: true };
  const turn = preparer([reviewPr(), livraison, seo], fallbacks).prepare(run, dir, content);
  expect(JSON.parse(turn.agentFlags.agents ?? "")).toHaveProperty("livraison");
  expect(turn.agentFlags.skillRules).toEqual([
    "Skill(brainstorming)",
    "Skill(brainstorming *)",
    "Skill(superpowers:brainstorming)",
    "Skill(superpowers:brainstorming *)",
  ]);
  expect(turn.agentFlags.name).toBeNull();
  expect(turn.promptTitle).toBe("# global · review-pr · KIB-3");
});

test("fallback: a subagent too long for the command line is refused", () => {
  const huge = testAgent({ id: "seo", name: "seo", body: "x".repeat(100_001) });
  const fallbacks = { ...NO_CLI_FALLBACKS, agentsInline: true };
  expect(() => preparer([reviewPr(), livraison, huge], fallbacks).prepare(run, runDir(), content)).toThrow(
    /INVALID_INPUT.*command line/,
  );
});
