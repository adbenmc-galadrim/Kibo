import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import {
  type Actor,
  type Agent,
  type AgentSettings,
  type AgentSettingsPatch,
  type AgentsState,
  DEFAULT_AGENT_SETTINGS,
  type DenialItem,
  KiboError,
  AgentSettingsPatch as PatchSchema,
  type Question,
  RESUME_AFTER_ALLOW,
  type RunView,
} from "@kibo/schema";
import { denialStore } from "../agents/denial-store";
import { runView } from "../questions/questions.test-helper";
import { type AllowResumeDeps, allowAndResume } from "./allow-resume";

const HOME = "/Users/dev";
const SKILLS = `${HOME}/.claude/skills`;
const ITEMS: DenialItem[] = [
  { tool: "Bash", target: "pnpm test", rule: "Bash(pnpm *)", addDir: null, reason: "ok" },
  { tool: "Bash", target: "tail -40", rule: "Bash(tail *)", addDir: null, reason: "ok" },
  { tool: "Read", target: `${SKILLS}/a.md`, rule: null, addDir: SKILLS, reason: "ok" },
  { tool: "Bash", target: "sudo ls", rule: "Bash(sudo *)", addDir: null, reason: "ok" },
  { tool: "Bash", target: 'sh -c "x"', rule: null, addDir: null, reason: "shell" },
];

function agentWith(settings: AgentSettings): Agent {
  return {
    ref: "global:livraison",
    scope: "global",
    projectId: null,
    name: "livraison",
    path: "/x",
    hash: null,
    file: null,
    problem: null,
    nameWarning: null,
    settings,
    shadowedBy: null,
    activeRuns: 0,
    modifiedAt: null,
  };
}

function setup(run: RunView, resumable: string[] = []) {
  const store = denialStore(new Database(":memory:", { strict: true }));
  store.save({ runId: "r1", turn: 1, items: ITEMS, questionId: "q1", seq: 3, at: 1 });
  let settings: AgentSettings = { ...DEFAULT_AGENT_SETTINGS, allow: ["Bash(git *)", "Bash(pnpm *)"] };
  const calls: string[] = [];
  const patch = mock((_ref: string, p: AgentSettingsPatch) => {
    calls.push("settings");
    settings = { ...settings, ...PatchSchema.parse(p) };
    return settings;
  });
  const answerQuestion = mock((_p: string, _q: string, _text: string, _by: Actor) => {
    calls.push("question");
  });
  const delivered = mock((_p: string, _t: string, _ids: readonly string[], _runId: string) => {
    calls.push("delivered");
  });
  let question: Pick<Question, "ticketId" | "answer" | "archivedAt"> | null = {
    ticketId: "t1",
    answer: null,
    archivedAt: null,
  };
  let resumeFails = false;
  const answerRun = mock((runId: string, _text: string): RunView => {
    if (resumeFails) throw new KiboError("TICKET_HAS_CHILDREN", "ce ticket regroupe 1 sous-ticket");
    calls.push("run");
    return { ...run, id: runId, state: "queued" };
  });
  const deps: AllowResumeDeps = {
    agents: { agentOf: () => agentWith(settings), settings: patch },
    questions: { get: () => question, answer: answerQuestion, markDelivered: delivered },
    orchestrator: {
      state: (): Pick<AgentsState, "runs" | "resumable"> => ({ runs: [run], resumable }),
      answer: answerRun,
    },
    denials: store,
    viewer: () => "adam",
    home: HOME,
  };
  return {
    deps,
    calls,
    patch,
    answerQuestion,
    answerRun,
    delivered,
    settings: () => settings,
    archived: () => {
      question = question && { ...question, archivedAt: 2 };
    },
    gone: () => {
      question = null;
    },
    failResume: () => {
      resumeFails = true;
    },
  };
}

const waiting = runView({ id: "r1", state: "waiting_input", profileId: "global:livraison" });
const input = { runId: "r1", questionId: "q1", rules: ["Bash(pnpm *)", "Bash(tail *)"], addDirs: [SKILLS] };

test("allowing patches the agent, resumes the run, then answers the question as the human, delivered", () => {
  const { deps, calls, answerQuestion, answerRun, delivered, settings } = setup(waiting);
  const result = allowAndResume(deps, input);
  expect(calls).toEqual(["settings", "run", "question", "delivered"]);
  expect(delivered.mock.calls[0]).toEqual(["p1", "t1", ["q1"], "r1"]);
  expect(settings().allow).toEqual(["Bash(git *)", "Bash(pnpm *)", "Bash(tail *)"]);
  expect(settings().addDirs).toEqual([SKILLS]);
  expect(answerQuestion.mock.calls[0]).toEqual([
    "p1",
    "q1",
    `Autorisé : Bash(pnpm *), Bash(tail *) ; ${SKILLS}`,
    { kind: "human", ref: "adam" },
  ]);
  expect(answerRun.mock.calls[0]).toEqual([
    "r1",
    RESUME_AFTER_ALLOW(["Bash(pnpm *)", "Bash(tail *)"], [SKILLS]),
  ]);
  expect(result.run.state).toBe("queued");
  expect(result.agent.settings.allow).toContain("Bash(tail *)");
});

test("a finished run that can be resumed is resumed too", () => {
  const done = { ...waiting, state: "done" as const };
  const { deps, calls } = setup(done, ["r1"]);
  allowAndResume(deps, input);
  expect(calls).toEqual(["settings", "run", "question", "delivered"]);
});

test("a question already answered, archived or removed is refused before any write", () => {
  for (const close of ["archived", "gone"] as const) {
    const kit = setup(waiting);
    kit[close]();
    expect(() => allowAndResume(kit.deps, input)).toThrow(
      expect.objectContaining({ code: "INVALID_TRANSITION" }),
    );
    expect(kit.calls).toEqual([]);
  }
});

test("a resume refused after the patch restores the agent settings and leaves the question open", () => {
  const kit = setup(waiting);
  const before = kit.settings();
  kit.failResume();
  expect(() => allowAndResume(kit.deps, input)).toThrow(
    expect.objectContaining({ code: "TICKET_HAS_CHILDREN" }),
  );
  expect(kit.settings().allow).toEqual(before.allow);
  expect(kit.settings().addDirs).toEqual(before.addDirs);
  expect(kit.answerQuestion).not.toHaveBeenCalled();
});

test("a run that cannot be resumed is refused before any write", () => {
  for (const run of [
    { ...waiting, state: "done" as const },
    { ...waiting, state: "running" as const },
  ]) {
    const { deps, calls } = setup(run);
    expect(() => allowAndResume(deps, input)).toThrow(
      expect.objectContaining({ code: "INVALID_TRANSITION" }),
    );
    expect(calls).toEqual([]);
  }
});

test("a proposed rule that became unsafe is refused by name and nothing is applied", () => {
  const { deps, calls } = setup(waiting);
  const unsafe = { ...input, rules: ["Bash(pnpm *)", "Bash(sudo *)"] };
  expect(() => allowAndResume(deps, unsafe)).toThrow(
    new KiboError("INVALID_INPUT", "rule Bash(sudo *) is not safe"),
  );
  expect(calls).toEqual([]);
});

test("rules, folders and questions foreign to the run are refused", () => {
  const { deps, calls } = setup(waiting);
  const cases = [
    { ...input, questionId: "q9" },
    { ...input, rules: ["Bash(curl *)"] },
    { ...input, addDirs: [`${HOME}/Documents`] },
    { ...input, rules: [], addDirs: [] },
    { ...input, addDirs: [`${HOME}/.ssh`] },
  ];
  for (const bad of cases) {
    expect(() => allowAndResume(deps, bad)).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  }
  expect(() => allowAndResume(deps, { ...input, runId: "r9" })).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(calls).toEqual([]);
});
