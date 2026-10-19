import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import {
  type AskInput,
  actionOf,
  DEFAULT_AGENT_SETTINGS,
  DEMO_AGENT_REF,
  EMPTY_DELIVERY,
  type ProjectDelivery,
  Question,
  type RunAction,
  type RunMoment,
  type RunView,
} from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { createDenialQuestion, type DenialQuestionDeps } from "./denial-question";
import { denialStore } from "./denial-store";
import { CLAUDE_DENIAL_TEXT } from "./fake-claude-transcript";

const HOME = "/Users/dev";
const CWD = `${HOME}/Documents/silo-feat-15`;

const refused = (tool: string, input: Record<string, unknown>): RunAction =>
  actionOf({ tool, input, output: CLAUDE_DENIAL_TEXT, isError: true, denied: true, patch: null });

const actionsMoment = (seq: number, actions: RunAction[]): RunMoment => ({
  id: seq,
  runId: "r1",
  seq,
  at: seq,
  stepId: null,
  data: { kind: "actions", actions, summary: "", failed: true },
});

const TURN_1: RunMoment[] = [
  { id: 0, runId: "r1", seq: 0, at: 0, stepId: null, data: { kind: "message", text: "Je lance les tests." } },
  actionsMoment(1, [
    refused("Bash", { command: "pnpm test" }),
    refused("Read", { file_path: `${HOME}/.claude/skills/full-delivery/reference/kibo.md` }),
    refused("Bash", { command: 'sh -c "rm -rf x"' }),
  ]),
];

function question(ask: AskInput, by: string): Question {
  return Question.parse({
    id: "q1",
    ticketId: "t1",
    runId: "r1",
    ...ask,
    createdBy: { kind: "agent", ref: by },
    createdAt: 1,
    answer: null,
  });
}

function setup(over: { moments?: RunMoment[]; quota?: boolean; delivery?: ProjectDelivery | null } = {}) {
  const store = denialStore(new Database(":memory:", { strict: true }));
  const moments = over.moments ?? TURN_1;
  const logs: string[] = [];
  const createQuestion = mock(
    (_p: string, _t: string, run: { id: string; profileName: string }, ask: AskInput) =>
      over.quota ? null : question(ask, run.profileName),
  );
  const deps: DenialQuestionDeps = {
    store,
    moments: (_runId, since) => moments.filter((m) => m.seq > since),
    agentOf: () => ({ settings: { ...DEFAULT_AGENT_SETTINGS, allow: ["Bash(git *)"] } }),
    project: () => (over.delivery === undefined ? EMPTY_DELIVERY : over.delivery),
    data: { createQuestion },
    home: HOME,
    now: () => 42,
    log: (line) => logs.push(line),
  };
  const run = (p: Partial<RunView> = {}) => runView({ id: "r1", cwd: CWD, turns: 1, ...p });
  return { store, deps, createQuestion, logs, run };
}

test("a turn with Claude Code refusals asks one question authored by Kibo", () => {
  const { deps, createQuestion, store, run } = setup();
  expect(createDenialQuestion(deps, run())).toBe("q1");
  expect(createQuestion).toHaveBeenCalledTimes(1);
  const [projectId, ticketId, author, ask] = createQuestion.mock.calls[0] ?? [];
  expect([projectId, ticketId, author]).toEqual(["p1", "t1", { id: "r1", profileName: "kibo" }]);
  expect(ask).toMatchObject({
    kind: "question",
    title: "3 actions refusées pendant le run",
    blocking: false,
    recipient: "me",
    options: [],
  });
  expect(ask?.context).toContain("- `pnpm test` ⇒ `Bash(pnpm *)`");
  expect(ask?.context).toContain("⇒ dossier `~/.claude/skills`");
  expect(ask?.context).toContain('- `sh -c "rm -rf x"` ⇒ à autoriser à la main');
  expect(store.get("r1")).toMatchObject({ runId: "r1", turn: 1, questionId: "q1", at: 42 });
  expect(store.get("r1")?.items.map((i) => i.rule ?? i.addDir ?? i.reason)).toEqual([
    "Bash(pnpm *)",
    `${HOME}/.claude/skills`,
    "shell",
  ]);
});

test("the next turn only reads the moments after the last saved one", () => {
  const { deps, createQuestion, run } = setup();
  createDenialQuestion(deps, run());
  expect(createDenialQuestion(deps, run({ turns: 2 }))).toBeNull();
  expect(createQuestion).toHaveBeenCalledTimes(1);
});

test("the same turn is never asked twice", () => {
  const { deps, createQuestion, run } = setup();
  createDenialQuestion(deps, run());
  expect(createDenialQuestion(deps, run())).toBeNull();
  expect(createQuestion).toHaveBeenCalledTimes(1);
});

test("nothing is asked without a Claude Code refusal, for a project run or the demo agent", () => {
  const ok = actionOf({
    tool: "Bash",
    input: { command: "ls" },
    output: "a",
    isError: false,
    denied: false,
    patch: null,
  });
  const quiet = setup({ moments: [actionsMoment(0, [ok])] });
  expect(createDenialQuestion(quiet.deps, quiet.run())).toBeNull();
  expect(quiet.store.get("r1")).toBeNull();
  const { deps, createQuestion, store, run } = setup();
  expect(createDenialQuestion(deps, run({ kind: "project", ticketId: null }))).toBeNull();
  expect(createDenialQuestion(deps, run({ profileId: DEMO_AGENT_REF }))).toBeNull();
  expect(createQuestion).not.toHaveBeenCalled();
  expect(store.get("r1")).toBeNull();
});

test("a run without ticket is logged and asks nothing", () => {
  const { deps, createQuestion, logs, run } = setup();
  expect(createDenialQuestion(deps, run({ ticketId: null }))).toBeNull();
  expect(createQuestion).not.toHaveBeenCalled();
  expect(logs).toEqual(["run r1 : refus ignorés : run sans ticket"]);
});

test("a full question quota keeps the denials without question and logs it", () => {
  const { deps, store, logs, run } = setup({ quota: true });
  expect(createDenialQuestion(deps, run())).toBeNull();
  expect(store.get("r1")).toMatchObject({ turn: 1, questionId: null });
  expect(logs).toEqual(["run r1 : question des refus ignorée : trop de questions ouvertes"]);
});

test("rules and folders of the project delivery count as already allowed", () => {
  const delivery = { ...EMPTY_DELIVERY, allow: ["Bash(pnpm *)"], addDirs: [`${HOME}/.claude/skills`] };
  const { deps, createQuestion, run } = setup({ delivery });
  createDenialQuestion(deps, run());
  expect(createQuestion.mock.calls[0]?.[3].title).toBe("1 action refusée pendant le run");
});

test("every proposed rule is shown before it is accepted, even a broad one", () => {
  const moments = [actionsMoment(0, [refused("Bash", { command: "rm -rf dist && git status" })])];
  const { deps, createQuestion, run } = setup({ moments });
  createDenialQuestion(deps, run());
  expect(createQuestion.mock.calls[0]?.[3].context).toContain("- `rm -rf dist` ⇒ `Bash(rm *)`");
});
