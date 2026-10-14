import { expect, test } from "bun:test";
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { type Agent, EMPTY_DELIVERY, type ProjectSnapshot, type RunView } from "@kibo/schema";
import { testRef } from "./agents-port.test-helper";
import { fakeCalls } from "./fake-claude-scenario";
import { createOrchestrator, type Orchestrator } from "./orchestrator";
import {
  cleanHarness,
  type Harness,
  knownSkill,
  setup,
  testAgent,
  waitUntil,
} from "./orchestrator.test-helper";
import type { TurnPrefixPort } from "./orchestrator-types";

cleanHarness();

const SECTION = "## Travail en cours sur le projet\n\n### bou · livraison · BOU-12 · Dates";

function prefixer() {
  const briefs: string[] = [];
  const prompts: { runId: string; turns: number }[] = [];
  const port: TurnPrefixPort = {
    briefSection: async (run: RunView) => {
      briefs.push(run.id);
      return SECTION;
    },
    changedSection: async (run: RunView) => {
      prompts.push({ runId: run.id, turns: run.turns });
      return SECTION;
    },
  };
  return { port, briefs, prompts };
}

test("a ticket run gets the work in progress in its brief, then before each later answer", async () => {
  const h = setup({ scenario: "question" });
  await h.orch.stop();
  const p = prefixer();
  const orch = createOrchestrator({ ...h.options, turnPrefix: p.port });
  h.route(orch);
  try {
    const first = orch.assign({ projectId: "p1", ticketId: "t1", profileId: testRef("opus"), brief: "" });
    const view = () => orch.state().runs.find((r) => r.id === first.id);
    await waitUntil(() => view()?.state === "waiting_input");
    orch.answer(first.id, "Port dynamique");
    await waitUntil(() => view()?.state === "done");
    const calls = fakeCalls(h.state, first.sessionId);
    expect(calls[0]?.prompt).toContain(SECTION);
    expect(calls[1]?.prompt).toBe(`${SECTION}\n\n# Message\n\nPort dynamique`);
    expect(p.briefs).toEqual([first.id]);
    expect(p.prompts).toEqual([{ runId: first.id, turns: 1 }]);
  } finally {
    await orch.stop();
  }
}, 30_000);

test("without a prefixer the later turn is the raw answer", async () => {
  const h = setup({ scenario: "question" });
  const first = h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: testRef("opus"), brief: "" });
  const view = () => h.orch.state().runs.find((r) => r.id === first.id);
  await waitUntil(() => view()?.state === "waiting_input");
  h.orch.answer(first.id, "Port dynamique");
  await waitUntil(() => view()?.state === "done");
  expect(fakeCalls(h.state, first.sessionId)[1]?.prompt).toBe("Port dynamique");
}, 30_000);

test("a skill typed with a slash reaches claude as an explicit Skill instruction, the run keeps the text", async () => {
  const h = setup({ scenario: "question", skills: [knownSkill("brainstorming")] });
  const first = h.orch.assign({
    projectId: "p1",
    ticketId: "t1",
    profileId: testRef("opus"),
    brief: "/brainstorming d'abord",
  });
  const view = () => h.orch.state().runs.find((r) => r.id === first.id);
  await waitUntil(() => view()?.state === "waiting_input");
  h.orch.answer(first.id, "/brainstorming en deux phrases, pas /compact");
  await waitUntil(() => view()?.state === "done");
  const calls = fakeCalls(h.state, first.sessionId);
  expect(calls[0]?.prompt).toContain(
    "## Consignes\n\nUtilise le skill `brainstorming` (outil Skill) avec : d'abord",
  );
  expect(calls[1]?.prompt).toBe(
    "Utilise le skill `brainstorming` (outil Skill) avec : en deux phrases, pas /compact",
  );
  expect(view()?.brief).toBe("/brainstorming d'abord");
}, 30_000);

const spawnedOf = (orch: Orchestrator, id: string) =>
  orch.log(id).flatMap((e) => (e.event.type === "spawned" ? [e.event] : []))[0];

function withAgent(h: Harness, agent: Agent): Orchestrator {
  const data = { ...h.options.data, agentOf: (ref: string) => (ref === agent.ref ? agent : null) };
  const orch = createOrchestrator({ ...h.options, data });
  h.route(orch);
  return orch;
}

test("a ticket run receives the folders of its agent and of its project, missing ones left out", async () => {
  const meta: Partial<ProjectSnapshot["meta"]> = {};
  const h = setup({ scenario: "done", meta });
  await h.orch.stop();
  for (const dir of [".claude/skills", "Documents/emis"]) mkdirSync(join(h.home, dir), { recursive: true });
  const skills = realpathSync(join(h.home, ".claude", "skills"));
  const emis = realpathSync(join(h.home, "Documents", "emis"));
  meta.delivery = { ...EMPTY_DELIVERY, addDirs: [join(h.home, "Documents", "emis"), join(h.home, "gone")] };
  const orch = withAgent(h, testAgent({ addDirs: [join(h.home, ".claude", "skills")] }));
  try {
    const run = orch.assign({ projectId: "p1", ticketId: "t1", profileId: testRef("opus"), brief: "" });
    await waitUntil(() => orch.state().runs.find((r) => r.id === run.id)?.state === "done");
    const argv = fakeCalls(h.state, run.sessionId)[0]?.argv ?? [];
    const at = argv.indexOf("--add-dir");
    expect(argv.slice(at, at + 3)).toEqual(["--add-dir", skills, emis]);
    expect(argv[at + 3]?.startsWith("--")).toBe(true);
    expect(spawnedOf(orch, run.id)).toMatchObject({ addDirs: [skills, emis] });
  } finally {
    await orch.stop();
  }
}, 30_000);

test("a forbidden folder stored on the agent fails the run with its name", async () => {
  const h = setup({ scenario: "done" });
  await h.orch.stop();
  const orch = withAgent(h, testAgent({ addDirs: [join(h.home, ".kibo")] }));
  try {
    const run = orch.assign({ projectId: "p1", ticketId: "t1", profileId: testRef("opus"), brief: "" });
    const view = () => orch.state().runs.find((r) => r.id === run.id);
    await waitUntil(() => view()?.state === "failed");
    expect(view()?.error).toContain(".kibo");
    expect(fakeCalls(h.state, run.sessionId)).toEqual([]);
  } finally {
    await orch.stop();
  }
}, 30_000);
