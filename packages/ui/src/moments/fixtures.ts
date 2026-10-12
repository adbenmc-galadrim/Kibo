import {
  type AgentsState,
  type MomentData,
  type ProjectSnapshot,
  progressSummary,
  type RunAction,
  type RunMoment,
  type RunMomentsPage,
  type RunReport,
  type Step,
  summarizeActions,
  type TicketProgress,
} from "@kibo/schema";
import { agentsFixture, kiboProject, NOW, runFixture } from "../agents/fixtures";

const MIN = 60_000;
export const FEED_RUN = "r41";
export const REPORTED_RUN = "r38";
export const UNREPORTED_RUN = "r40";
export const WORKTREE = "/Users/adam/goinfre/Kibo/.kibo/worktrees/kib-14";

const action = (p: Partial<RunAction> & Pick<RunAction, "kind" | "label">): RunAction => ({
  tool: "Read",
  target: null,
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
  ...p,
});

const READS: RunAction[] = [
  action({
    kind: "read",
    label: "A lu `packages/daemon/src/hooks/receiver.ts`",
    target: "packages/daemon/src/hooks/receiver.ts",
  }),
  action({
    kind: "read",
    label: "A lu `packages/daemon/src/hooks/receiver.test.ts`",
    target: "packages/daemon/src/hooks/receiver.test.ts",
  }),
];

const EDITS: RunAction[] = [
  action({
    tool: "Edit",
    kind: "edit",
    label: "A modifié `packages/daemon/src/hooks/receiver.ts` (+8 −3)",
    target: "packages/daemon/src/hooks/receiver.ts",
    patch: { added: 8, removed: 3 },
    detail:
      '@@ -12,3 +12,8 @@\n-  if (!body) return;\n+  if (!body) throw new KiboError("INVALID_INPUT", "empty body");',
  }),
  action({
    tool: "Bash",
    kind: "test",
    label: "A lancé les tests (12 réussis, 1 échec)",
    target: "bun test packages/daemon/src/hooks",
    outcome: "error",
    tests: { passed: 12, failed: 1 },
    detail: "12 pass\n1 fail\nexpect(received).toBe(expected)",
  }),
];

export const SKILL_ACTIONS: RunAction[] = [
  action({
    tool: "Skill",
    kind: "skill",
    label: "A utilisé le skill `brainstorming`",
    target: "brainstorming",
  }),
  action({
    tool: "Skill",
    kind: "skill",
    label: "A utilisé le skill `deploy`",
    target: "deploy",
    outcome: "denied",
    detail: "skill non autorisé par Kibo",
  }),
  action({
    tool: "Agent",
    kind: "subagent",
    label: "A lancé un sous-agent seo",
    target: "seo",
    outcome: "denied",
  }),
  action({
    tool: "mcp__kibo__skill_review",
    kind: "mcp",
    label: "A laissé une review de 2 skills",
    target: "skill_review",
  }),
];

export const actions = (list: RunAction[]): MomentData => ({
  kind: "actions",
  actions: list,
  summary: summarizeActions(list),
  failed: list.some((a) => a.outcome !== "ok"),
});

const moment = (seq: number, minutesAgo: number, stepId: string | null, data: MomentData): RunMoment => ({
  id: seq,
  runId: FEED_RUN,
  seq,
  at: NOW - minutesAgo * MIN,
  stepId,
  data,
});

export const MOMENTS: RunMoment[] = [
  moment(1, 9, null, { kind: "reminder", reminder: "plan" }),
  moment(2, 8, "s1", {
    kind: "message",
    text: "Je relis le récepteur et ses tests avant de toucher au port.",
  }),
  moment(3, 8, "s1", actions(READS)),
  moment(4, 6, "s2", {
    kind: "message",
    text: "La validation laisse passer un corps vide. Je la corrige dans **receiver.ts**.",
  }),
  moment(5, 5, "s2", {
    kind: "reasoning",
    text: "Le corps vide passe parce que le test ne couvre que null.",
  }),
  moment(6, 4, "s2", actions(EDITS)),
  moment(7, 3, "s2", {
    kind: "message",
    text: "Un test échoue encore : quel port veux-tu pour le récepteur ?",
  }),
];

export const PLAN: Step[] = [
  { id: "s1", title: "Relire le récepteur et ses tests", status: "done", note: null },
  { id: "s2", title: "Corriger la validation du corps", status: "doing", note: null },
  { id: "s3", title: "Choisir le port du récepteur", status: "todo", note: null },
  { id: "s4", title: "Brancher le récepteur sur le démon", status: "blocked", note: "attend KIB-12" },
  { id: "s5", title: "Documenter le format des hooks", status: "todo", note: null },
];

export const REPORT: RunReport = {
  runId: REPORTED_RUN,
  at: NOW - 3 * 60 * MIN,
  done: "Le récepteur accepte les hooks signés et rejette les corps vides.",
  decisions: ["Port 4747 par défaut, écrit dans ~/.kibo/daemon.json"],
  toCheck: ["Le délai de 5 s convient-il aux gros dépôts ?", "Le message d'erreur est-il assez clair ?"],
  files: ["packages/daemon/src/hooks/receiver.ts", "packages/daemon/src/hooks/README.md"],
  next: "Brancher le récepteur sur le démon.",
  check: {
    undeclared: ["packages/daemon/src/hooks/receiver.test.ts"],
    unchanged: ["packages/daemon/src/hooks/README.md"],
  },
};

export const PROGRESS: TicketProgress = {
  plan: PLAN,
  planRunId: FEED_RUN,
  planAt: NOW - 6 * MIN,
  reports: [REPORT],
};

export const MOMENTS_PAGE: RunMomentsPage = {
  moments: MOMENTS,
  internalPlan: null,
  partial: null,
  source: "transcript",
};

export function dockState(): AgentsState {
  const base = agentsFixture();
  const runs = base.runs.map((r) =>
    r.id === FEED_RUN ? { ...r, ticketId: "t14", cwd: WORKTREE, workspace: "worktree:kib-14" } : r,
  );
  const reported = runFixture({
    id: REPORTED_RUN,
    seq: 38,
    ticketId: "t14",
    ticketKey: "KIB-14",
    ticketTitle: "Récepteur de hooks Claude Code",
    label: "opus-dev-2",
    state: "done",
    startedAt: NOW - 4 * 60 * MIN,
    endedAt: NOW - 3 * 60 * MIN,
  });
  return {
    ...base,
    runs: [...runs, reported],
    progress: [
      progressSummary(FEED_RUN, PROGRESS),
      progressSummary(REPORTED_RUN, PROGRESS),
      { runId: "r43", step: { index: 2, total: 5, title: "Corriger la validation" }, report: null },
    ],
  };
}

export function progressProject(): ProjectSnapshot {
  const project = kiboProject();
  return {
    ...project,
    tickets: project.tickets.map((t) => (t.id === "t14" ? { ...t, agentProgress: PROGRESS } : t)),
  };
}
