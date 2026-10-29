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
    if (resumeFails) throw new KiboError("TICKET_HAS_CHILDREN", "ticket has 1 child ticket");
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

test("without ticket execution a ticket run is not resumed, nothing is patched and the question stays open", () => {
  const { deps, calls } = setup(waiting, []);
  expect(() => allowAndResume(deps, input)).toThrow("AGENT_EXECUTION_REMOVED");
  expect(calls).toEqual([]);
});
