import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fakeCalls, releaseFakeRun } from "./fake-claude-scenario";
import { assign, cleanHarness, run, setup, testAgent, waitUntil } from "./orchestrator.test-helper";

cleanHarness();

const livraison = testAgent({ id: "livraison", name: "livraison", maxParallel: 1 });
const reviewPr = testAgent({ id: "review-pr", name: "review-pr", projectId: "p1" });
const elsewhere = testAgent({ id: "seo", name: "seo", projectId: "p2" });
const disabled = testAgent({ id: "pause", name: "pause", enabled: false });
const unreadable = testAgent({ id: "casse", name: "casse", file: null });
const assistant = testAgent({ id: "assistant", name: "kibo-assistant", system: true });
const demo = testAgent({ id: "demo", name: "kibo-demo", system: true, maxParallel: 1 });
const agents = [livraison, reviewPr, elsewhere, disabled, unreadable, assistant, demo];

test("a run takes the ref, the name, the scope and the project key of its agent", () => {
  const h = setup({ scenario: "hold", profiles: agents });
  const global = assign(h, "t3", "global:livraison");
  expect(global).toMatchObject({
    profileId: "global:livraison",
    profileName: "livraison",
    agentScope: "global",
    projectKey: "KIB",
    label: "global · livraison · KIB-3",
  });
  const local = assign(h, "t2", "project:p1:review-pr");
  expect(local).toMatchObject({ agentScope: "project", label: "kib · review-pr · KIB-2" });
  expect(h.assigned).toEqual(["t3:livraison", "t2:review-pr"]);
  for (const r of [global, local]) h.orch.cancel(r.id);
});

test("a ticket refuses Kibo's agents, disabled, unreadable and foreign agents, and unknown refs", () => {
  const h = setup({ scenario: "hold", profiles: agents });
  const refused: [string, string | RegExp][] = [
    ["system:assistant", /INVALID_INPUT.*reserved to Kibo/],
    ["system:demo", /INVALID_INPUT.*demo project/],
    ["global:pause", /INVALID_INPUT.*disabled/],
    ["global:casse", /INVALID_INPUT.*unreadable/],
    ["project:p2:seo", /INVALID_INPUT.*another project/],
    ["global:absent", /AGENT_NOT_FOUND/],
  ];
  for (const [ref, error] of refused) {
    expect(() => assign(h, "t1", ref)).toThrow(error);
    expect(() => h.orch.preview({ projectId: "p1", ticketId: "t1", profileId: ref })).toThrow(error);
  }
  expect(h.orch.state().runs).toEqual([]);
  expect(h.assigned).toEqual([]);
});

test("the slots of an agent are counted by ref", async () => {
  const h = setup({ scenario: "hold", profiles: agents });
  const first = assign(h, "t1", "global:livraison");
  const second = assign(h, "t2", "global:livraison");
  expect(h.orch.state().queue.find((q) => q.runId === second.id)?.reason).toEqual({
    kind: "agent",
    agentName: "livraison",
    used: 1,
    total: 1,
  });
  expect(h.orch.activeRuns("global:livraison")).toBe(2);
  expect(run(h, second.id).state).toBe("queued");
  releaseFakeRun(h.state, first.sessionId);
  h.orch.cancel(second.id);
});

const reviewer = () =>
  testAgent({
    id: "review",
    name: "review",
    model: "fable",
    tools: ["Read", "Grep"],
    body: "Tu relis.",
    subagents: ["global:livraison"],
    skills: { mode: "list", ids: ["brainstorming"] },
  });
const flagOf = (argv: string[], name: string) => argv[argv.indexOf(name) + 1];

test("a ticket run launches with its agent's model, subagents, tools, snapshot and session name", async () => {
  const h = setup({ scenario: "done", profiles: [reviewer(), livraison] });
  const r = assign(h, "t1", "global:review");
  await waitUntil(() => run(h, r.id).state === "done");
  const [call] = fakeCalls(h.state, r.sessionId);
  const argv = call?.argv ?? [];
  expect(flagOf(argv, "--model")).toBe("fable");
  expect(flagOf(argv, "--agents")).toBe(join(h.home, "runs", r.id, "agents.json"));
  expect(flagOf(argv, "--tools")).toBe("Read,Grep");
  expect(flagOf(argv, "--system-prompt-snapshot")).toBe("off");
  expect(flagOf(argv, "--name")).toBe("global · review · KIB-1");
  expect(call?.prompt.startsWith("# KIB-1")).toBe(true);
  expect(readFileSync(join(h.home, "runs", r.id, "CLAUDE.md"), "utf8")).toContain("## agent · review");
});

test("the live guard of a run refuses a skill outside its list", async () => {
  const h = setup({ scenario: "hold", profiles: [reviewer(), livraison] });
  const r = assign(h, "t1", "global:review");
  await waitUntil(() => run(h, r.id).state === "running");
  const payload = {
    event: "PreToolUse" as const,
    sessionId: r.sessionId,
    transcriptPath: null,
    tool: "Skill",
    detail: null,
    question: null,
    agentId: null,
    toolUseId: null,
    ask: null,
    todos: null,
    stopHookActive: false,
  };
  expect(h.orch.hooks.receive(r.id, payload, { skill: "deploy" })).toMatchObject({ decision: "deny" });
  expect(h.orch.hooks.receive(r.id, payload, { skill: "brainstorming" })).toBeNull();
  releaseFakeRun(h.state, r.sessionId);
});

test("a subagent whose file disappeared fails the next turn with AGENT_NOT_FOUND, and the run resumes once it is back", async () => {
  const agents = [reviewer(), livraison];
  const h = setup({ scenario: "done", profiles: agents });
  const r = assign(h, "t1", "global:review");
  await waitUntil(() => run(h, r.id).state === "done");
  agents.splice(1, 1);
  h.orch.answer(r.id, "Encore");
  await waitUntil(() => run(h, r.id).state === "failed");
  expect(run(h, r.id).error).toContain("AGENT_NOT_FOUND");
  expect(h.orch.state().resumable).toContain(r.id);
  agents.push(livraison);
  h.orch.answer(r.id, "Encore");
  await waitUntil(() => run(h, r.id).state === "done" && run(h, r.id).turns === 2);
});

test("fallback: the run name opens the first prompt when the CLI refuses --name", async () => {
  const h = setup({
    scenario: "done",
    profiles: [reviewer(), livraison],
    cliFallbacks: { nameInPrompt: true },
  });
  const r = assign(h, "t1", "global:review");
  await waitUntil(() => run(h, r.id).state === "done");
  const [call] = fakeCalls(h.state, r.sessionId);
  expect(call?.argv).not.toContain("--name");
  expect(call?.prompt.startsWith("# global · review · KIB-1\n\n# KIB-1")).toBe(true);
});
