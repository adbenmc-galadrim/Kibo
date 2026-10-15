import type { RunAction, RunMoment, RunSubagent, RunSubagentSummary } from "@kibo/schema";
import { summarizeActions } from "@kibo/schema";
import { NOW } from "../agents/fixtures";
import { FEED_RUN } from "./fixtures";

const MIN = 60_000;

export const EXPLORE_ID = "a-explore";
export const CORRECTNESS_ID = "a-correctness";
export const CONVENTIONS_ID = "a-conventions";
export const FAILED_ID = "a-seo";

export const CORRECTNESS_PROMPT =
  "Relis le diff de la branche feat/compte-non-provisionne sous l'angle correctness : erreurs, cas limites, tests.";

const subagent = (
  p: Partial<RunSubagent> & Pick<RunSubagent, "id" | "type" | "description">,
): RunSubagent => ({
  runId: FEED_RUN,
  toolUseId: `toolu_${p.id}`,
  prompt: `Consigne de ${p.id}`,
  model: null,
  state: "running",
  startedAt: NOW - 2 * MIN,
  endedAt: null,
  result: null,
  actions: 0,
  parentId: null,
  transcriptPath: null,
  ...p,
});

export const EXPLORE = subagent({
  id: EXPLORE_ID,
  type: "Explore",
  description: "Repérage des zones auth",
  state: "done",
  startedAt: NOW - 30 * MIN,
  endedAt: NOW - 29 * MIN,
  actions: 9,
  result:
    "Provisionnement dans apps/server/src/auth/provision.ts ; la connexion ne distingue pas le compte absent.",
});

export const CORRECTNESS = subagent({
  id: CORRECTNESS_ID,
  type: "ecc:code-reviewer",
  description: "Porte qualité — correctness",
  prompt: CORRECTNESS_PROMPT,
  model: "sonnet",
  actions: 4,
});

export const CONVENTIONS = subagent({
  id: CONVENTIONS_ID,
  type: "ecc:code-reviewer",
  description: "Porte qualité — conventions",
  state: "done",
  startedAt: NOW - 6 * MIN,
  endedAt: NOW - 2 * MIN,
  actions: 2,
  result: "Conventions respectées ; un nom de fichier à passer en kebab-case.",
});

export const FAILED = subagent({
  id: FAILED_ID,
  type: "seo",
  description: "Audit SEO",
  state: "failed",
  startedAt: NOW - 5 * MIN,
  endedAt: NOW - 4 * MIN,
});

export const SUBAGENTS: RunSubagent[] = [EXPLORE, CONVENTIONS, CORRECTNESS];

export const activeSummary = (s: RunSubagent, runId = s.runId): RunSubagentSummary => ({
  runId,
  id: s.id,
  type: s.type,
  description: s.description,
  state: s.state,
  startedAt: s.startedAt,
});

const launch = (s: RunSubagent): RunAction => ({
  tool: "Agent",
  kind: "subagent",
  label: `A lancé un sous-agent ${s.type}`,
  target: s.type,
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
  callId: s.toolUseId ?? undefined,
});

const READ: RunAction = {
  tool: "Read",
  kind: "read",
  label: "A lu `apps/server/src/auth/provision.ts`",
  target: "apps/server/src/auth/provision.ts",
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
};

const at = (seq: number, minutesAgo: number, data: RunMoment["data"], subagentId?: string): RunMoment => ({
  id: 100 + seq,
  runId: FEED_RUN,
  seq: 100 + seq,
  at: NOW - minutesAgo * MIN,
  stepId: null,
  ...(subagentId === undefined ? {} : { subagentId }),
  data,
});

const actionsOf = (list: RunAction[]): RunMoment["data"] => ({
  kind: "actions",
  actions: list,
  summary: summarizeActions(list),
  failed: false,
});

const announce = (s: RunSubagent): RunMoment["data"] => ({
  kind: "subagent",
  subagentId: s.id,
  type: s.type,
  description: s.description,
});

export const LAUNCH_MOMENTS: RunMoment[] = [
  at(1, 3, actionsOf([READ, launch(CORRECTNESS)])),
  at(2, 2, announce(CORRECTNESS)),
  at(3, 1, actionsOf([{ ...READ, target: "apps/web/src/routes/sign-in.tsx" }]), CORRECTNESS_ID),
];

export const NESTED_ACTIONS: RunAction[] = [
  { ...READ, tool: "Bash", kind: "git", label: "A lancé `git diff`", target: "git diff origin/dev...HEAD" },
  READ,
];

export const nestedMoment = (seq: number, subagentId = CORRECTNESS_ID): RunMoment =>
  at(seq, 1, actionsOf(NESTED_ACTIONS), subagentId);

export const subagentMoment = (s: RunSubagent, seq = 50): RunMoment => at(seq, 2, announce(s));

export const launchMoment = (s: RunSubagent, seq = 49): RunMoment => at(seq, 3, actionsOf([launch(s)]));
