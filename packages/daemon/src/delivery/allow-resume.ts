import {
  type Actor,
  type Agent,
  type AgentSettings,
  type AgentSettingsPatch,
  type AgentsState,
  isSafeAddDir,
  isSafeAllowRule,
  KiboError,
  type Question,
  RESUME_AFTER_ALLOW,
  type RunDenials,
  type RunView,
  TERMINAL_STATES,
} from "@kibo/schema";
import { denialTexts } from "../agents/denial-question-texts";
import type { DenialStore } from "../agents/denial-store";

export type AllowResumeInput = {
  runId: string;
  questionId: string;
  rules: readonly string[];
  addDirs: readonly string[];
};
export type AllowResumeDeps = {
  agents: {
    agentOf(ref: string): Agent | null;
    settings(ref: string, patch: AgentSettingsPatch): AgentSettings;
  };
  questions: {
    get(projectId: string, questionId: string): Pick<Question, "ticketId" | "answer" | "archivedAt"> | null;
    answer(projectId: string, questionId: string, text: string, by: Actor): void;
    markDelivered(projectId: string, ticketId: string, questionIds: readonly string[], runId: string): void;
  };
  orchestrator: {
    state(): Pick<AgentsState, "runs" | "resumable">;
    answer(runId: string, text: string): RunView;
  };
  denials: Pick<DenialStore, "get">;
  viewer(projectId: string): string;
  home: string;
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];
const invalid = (message: string): KiboError => new KiboError("INVALID_INPUT", message);

function proposalsOf(deps: AllowResumeDeps, input: AllowResumeInput): RunDenials {
  const denials = deps.denials.get(input.runId);
  if (denials === null || denials.questionId !== input.questionId) {
    throw invalid(`question ${input.questionId} is not the denial question of run ${input.runId}`);
  }
  return denials;
}

function assertAllowed(denials: RunDenials, rules: readonly string[], dirs: readonly string[], home: string) {
  if (rules.length === 0 && dirs.length === 0) throw invalid("nothing to allow");
  for (const rule of rules) {
    if (!denials.items.some((i) => i.rule === rule)) throw invalid(`rule ${rule} was not proposed`);
    if (!isSafeAllowRule(rule)) throw invalid(`rule ${rule} is not safe`);
  }
  for (const dir of dirs) {
    if (!denials.items.some((i) => i.addDir === dir)) throw invalid(`folder ${dir} was not proposed`);
    if (!isSafeAddDir(dir, home)) throw invalid(`folder ${dir} is not safe`);
  }
}

function resumableRun(deps: AllowResumeDeps, runId: string): RunView & { projectId: string } {
  const state = deps.orchestrator.state();
  const run = state.runs.find((r) => r.id === runId);
  if (!run) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
  const { projectId } = run;
  if (projectId === null) throw invalid(`run ${runId} has no project`);
  const terminal = TERMINAL_STATES.includes(run.state);
  if (run.state !== "waiting_input" && !(terminal && state.resumable.includes(runId))) {
    throw new KiboError("INVALID_TRANSITION", `run ${runId} cannot be resumed`);
  }
  return { ...run, projectId };
}

function openQuestion(deps: AllowResumeDeps, projectId: string, questionId: string) {
  const question = deps.questions.get(projectId, questionId);
  if (question === null || question.answer !== null || question.archivedAt !== null) {
    throw new KiboError("INVALID_TRANSITION", `question ${questionId} is no longer open`);
  }
  return question;
}

function resumeOrRestore(deps: AllowResumeDeps, agent: Agent, runId: string, text: string): RunView {
  try {
    return deps.orchestrator.answer(runId, text);
  } catch (e) {
    deps.agents.settings(agent.ref, { allow: agent.settings.allow, addDirs: agent.settings.addDirs });
    throw e;
  }
}

export function allowAndResume(
  deps: AllowResumeDeps,
  input: AllowResumeInput,
): { agent: Agent; run: RunView } {
  const rules = unique(input.rules);
  const dirs = unique(input.addDirs);
  const run = resumableRun(deps, input.runId);
  if (run.kind === "ticket" && run.ticketId !== null)
    throw new KiboError("AGENT_EXECUTION_REMOVED", "allowAndResume: Kibo no longer runs ticket agents");
  assertAllowed(proposalsOf(deps, input), rules, dirs, deps.home);
  const question = openQuestion(deps, run.projectId, input.questionId);
  const agent = deps.agents.agentOf(run.profileId);
  if (!agent) throw new KiboError("AGENT_NOT_FOUND", `agent ${run.profileId} not found`);
  const settings = deps.agents.settings(agent.ref, {
    allow: unique([...agent.settings.allow, ...rules]),
    addDirs: unique([...agent.settings.addDirs, ...dirs]),
  });
  const resumed = resumeOrRestore(deps, agent, run.id, RESUME_AFTER_ALLOW(rules, dirs));
  const by: Actor = { kind: "human", ref: deps.viewer(run.projectId) };
  deps.questions.answer(run.projectId, input.questionId, denialTexts.answer(rules, dirs), by);
  deps.questions.markDelivered(run.projectId, question.ticketId, [input.questionId], resumed.id);
  return { agent: { ...agent, settings }, run: resumed };
}
