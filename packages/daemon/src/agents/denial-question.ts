import { dirname } from "node:path";
import {
  type Agent,
  type AskInput,
  DEMO_AGENT_REF,
  type DenialItem,
  isProjectRun,
  ME_RECIPIENT,
  type ProjectDelivery,
  type Question,
  type RunAction,
  type RunMoment,
  type RunView,
} from "@kibo/schema";
import type { AgentDataPort } from "../runs/orchestrator-types";
import { denialTexts } from "./denial-question-texts";
import type { DenialStore } from "./denial-store";
import { denialsOfTurn, type TurnDenialContext } from "./denials";

export type DenialQuestionDeps = {
  store: DenialStore;
  moments(runId: string, sinceSeq: number): RunMoment[];
  agentOf(ref: string): Pick<Agent, "settings"> | null;
  project(projectId: string): ProjectDelivery | null;
  data: Pick<AgentDataPort, "createQuestion">;
  home: string;
  now(): number;
  log(line: string): void;
  onQuestion?(run: RunView, question: Question, count: number): void;
};

const actionsOf = (moments: readonly RunMoment[]): RunAction[] =>
  moments.flatMap((m) => (m.data.kind === "actions" ? m.data.actions : []));

function contextOf(deps: DenialQuestionDeps, run: RunView, projectId: string): TurnDenialContext {
  const delivery = deps.project(projectId);
  const settings = deps.agentOf(run.profileId)?.settings;
  const known = [
    `${deps.home}/.claude/skills`,
    delivery?.root ?? null,
    delivery?.memory ? dirname(delivery.memory) : null,
  ].filter((dir): dir is string => dir !== null);
  return {
    home: deps.home,
    cwd: run.cwd ?? run.workspace ?? "",
    known,
    allowed: [...(settings?.allow ?? []), ...(delivery?.allow ?? [])],
    addDirs: [...(settings?.addDirs ?? []), ...(delivery?.addDirs ?? [])],
  };
}

const askOf = (items: readonly DenialItem[], home: string): AskInput => ({
  title: denialTexts.title(items.length),
  context: denialTexts.context(items, home),
  options: [],
  provisional: null,
  blocking: false,
  recipient: ME_RECIPIENT,
  kind: "question",
  images: [],
});

const asksAboutDenials = (run: RunView): boolean => !isProjectRun(run) && run.profileId !== DEMO_AGENT_REF;

export function createDenialQuestion(deps: DenialQuestionDeps, run: RunView): string | null {
  if (!asksAboutDenials(run) || deps.store.get(run.id)?.turn === run.turns) return null;
  if (run.projectId === null || run.ticketId === null) {
    deps.log(`run ${run.id} : refus ignorés : run sans ticket`);
    return null;
  }
  const moments = deps.moments(run.id, deps.store.lastSeq(run.id));
  const items = denialsOfTurn(actionsOf(moments), run.denied, contextOf(deps, run, run.projectId));
  const last = moments.at(-1);
  if (items.length === 0 || last === undefined) return null;
  const author = { id: run.id, profileName: denialTexts.author };
  const question = deps.data.createQuestion(run.projectId, run.ticketId, author, askOf(items, deps.home));
  if (question === null) deps.log(`run ${run.id} : question des refus ignorée : trop de questions ouvertes`);
  const questionId = question?.id ?? null;
  deps.store.save({ runId: run.id, turn: run.turns, items, questionId, seq: last.seq, at: deps.now() });
  if (question !== null) deps.onQuestion?.(run, question, items.length);
  return questionId;
}
