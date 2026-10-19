import { expect, test } from "bun:test";
import type { CiRun, ProjectSnapshot } from "@kibo/schema";
import { featureActivity, featureQuestions } from "./feature-feed";
import { featureDependencies } from "./feature-links";
import {
  featureBadge,
  nextStartableStep,
  nextStep,
  type StepFacts,
  sprintFacts,
  stepModels,
} from "./feature-model";
import { NOW, SESSION_RUN, siloFeatureProject } from "./fixture";

const project = siloFeatureProject();
const facts = (patch: Partial<StepFacts> = {}): StepFacts => ({
  runs: [],
  ciRuns: [],
  now: NOW,
  execution: "hidden",
  ...patch,
});
const withoutSessions = (p: ProjectSnapshot): ProjectSnapshot => ({
  ...p,
  tickets: p.tickets.map((t) => ({ ...t, session: null })),
});
const ciRun = (prNumber: number, conclusion: string): CiRun => ({
  repo: "silo-labs/silo-location",
  runId: prNumber,
  prNumber,
  ticketKey: null,
  headSha: "abc",
  workflow: "ci",
  status: "completed",
  conclusion,
  url: "https://github.com/silo-labs/silo-location/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
});
const f5 = () => {
  const t = project.tickets.find((x) => x.id === "f5");
  if (!t) throw new Error("fixture without F5");
  return t;
};

test("the steps follow the dependency order and carry their T3 Code session", () => {
  const steps = stepModels(project, "f5", facts());
  expect(steps.map((s) => [s.index, s.key, s.statusId])).toEqual([
    [1, "SILO-31", "done"],
    [2, "SILO-32", "in_review"],
    [3, "SILO-33", "in_progress"],
    [4, "SILO-34", "todo"],
    [5, "SILO-35", "todo"],
  ]);
  expect(steps[2]?.session).toEqual({ agent: "T3 Code", minutes: 42 });
  expect(steps.filter((s) => s.session !== null)).toHaveLength(1);
  expect(steps[3]?.blockedBy).toEqual(["SILO-33"]);
});

test("a live run is a session only when the execution is shown", () => {
  const bare = withoutSessions(project);
  expect(stepModels(bare, "f5", facts({ runs: [SESSION_RUN], execution: "shown" }))[2]?.session).toEqual({
    agent: "T3 Code",
    minutes: 42,
  });
  expect(stepModels(bare, "f5", facts({ runs: [SESSION_RUN] })).every((s) => s.session === null)).toBe(true);
  const finished = facts({ runs: [{ ...SESSION_RUN, state: "done" }], execution: "shown" });
  expect(stepModels(bare, "f5", finished).every((s) => s.session === null)).toBe(true);
});

test("the CI mark of a step comes from the runs of its PR, else from the PR checks", () => {
  expect(stepModels(project, "f5", facts()).map((s) => s.ci)).toEqual(["ok", "ok", null, null, null]);
  const failing = stepModels(project, "f5", facts({ ciRuns: [ciRun(22, "failure")] }));
  expect(failing[1]?.ci).toBe("error");
});

test("the next step to deliver is the first one not started, or back in review with changes requested", () => {
  const steps = stepModels(project, "f5", facts());
  expect(nextStep(steps)?.key).toBe("SILO-34");
  const asked = steps.map((s) =>
    s.pr && s.key === "SILO-32" ? { ...s, pr: { ...s.pr, review: "changes_requested" as const } } : s,
  );
  expect(nextStep(asked)?.key).toBe("SILO-32");
  expect(nextStep(steps.map((s) => ({ ...s, statusId: "done" as const })))).toBeNull();
});

const startability = (patch: Record<string, Partial<ProjectSnapshot["tickets"][number]>>) =>
  project.tickets.map((t) => ({ ...t, ...patch[t.id] }));

test("the action proposes only a startable step, the first one in order", () => {
  const steps = stepModels(project, "f5", facts());
  const tickets = startability({ e35: { startable: true } });
  expect(nextStartableStep(steps, tickets)).toEqual({
    step: expect.objectContaining({ key: "SILO-35" }),
    reason: null,
  });
  const both = startability({ e34: { startable: true }, e35: { startable: true } });
  expect(nextStartableStep(steps, both)?.step.key).toBe("SILO-34");
});

test("with no startable step, the next step comes with the reason it waits", () => {
  const steps = stepModels(project, "f5", facts());
  expect(nextStartableStep(steps, project.tickets)).toEqual({
    step: expect.objectContaining({ key: "SILO-34" }),
    reason: { kind: "dependency", keys: ["SILO-33"] },
  });
  expect(
    nextStartableStep(
      steps.map((s) => ({ ...s, statusId: "done" as const })),
      project.tickets,
    ),
  ).toBeNull();
});

test("a step back in review with changes requested is proposed as a touch-up", () => {
  const steps = stepModels(project, "f5", facts()).map((s) =>
    s.pr && s.key === "SILO-32" ? { ...s, pr: { ...s.pr, review: "changes_requested" as const } } : s,
  );
  expect(nextStartableStep(steps, project.tickets)).toEqual({
    step: expect.objectContaining({ key: "SILO-32" }),
    reason: null,
  });
});

test("the fixture F5 is still open on the last day of S42, late only the day after (§39.6.18)", () => {
  expect(f5().feature?.status).toBe("open");
  expect(f5().feature?.remaining).toBe(4);
});

const withStatus = (status: "open" | "late") => {
  const state = f5().feature;
  if (!state) throw new Error("F5 is a feature");
  return { ...f5(), feature: { ...state, status } };
};
const f5Steps = () => stepModels(project, "f5", facts());
const on = (today: string) => ({ today, steps: f5Steps() });

test("on the last day of S42, F5 is at risk: it will not fit and can move to the next sprint", () => {
  const sprint = sprintFacts(project, withStatus("open"), on("2026-10-16"));
  expect(sprint.sprint?.id).toBe("s42");
  expect(sprint.following?.id).toBe("s43");
  expect(sprint.warning).toEqual({ kind: "wontFit", remaining: 4 });
  expect(featureBadge(withStatus("late").feature)).toBe("late");
});

test("early in the sprint, a feature with enough working days left gets no warning", () => {
  const open = withStatus("open");
  expect(sprintFacts(project, open, on("2026-10-12")).warning).toBeNull();
  expect(featureBadge(open.feature)).toBe("open");
});

test("the day after S42, a late feature says the sprint is over", () => {
  expect(sprintFacts(project, withStatus("late"), on("2026-10-17")).warning).toEqual({
    kind: "over",
    remaining: 4,
  });
});

test("an unplanned feature has no sprint and nothing to move", () => {
  const unplanned = sprintFacts(project, { ...f5(), sprintId: null }, on("2026-10-16"));
  expect(unplanned).toEqual({ sprint: null, following: null, warning: null });
});

test("dependencies between features are read on the roots and on their steps", () => {
  const extra = { id: "l9", from: "e71", to: "e31", type: "blocks" as const };
  const deps = featureDependencies({ ...project, links: [...project.links, extra] }, "f5");
  expect(deps.waits).toEqual([
    { id: "f3", label: "F3", title: "Réaffecter un box", delivered: true, sprint: "S42" },
    { id: "f7", label: "F7", title: "Rapport de centre", delivered: false, sprint: "S44" },
  ]);
  expect(deps.unblocks).toEqual([
    { id: "f7", label: "F7", title: "Rapport de centre", delivered: false, sprint: "S44" },
  ]);
});

test("the activity lists PRs and delivery steps, newest first", () => {
  const steps = stepModels(project, "f5", facts());
  expect(featureActivity(steps, NOW).map((i) => [i.kind, i.text, i.time])).toEqual([
    ["pr_opened", "PR #22 ouverte · SILO-32", "15:04"],
    ["step", "Phase 7/12 · Porte qualité · SILO-33", "14:51"],
    ["pr_merged", "PR #19 fusionnée · SILO-31", "hier"],
  ]);
});

test("the open questions of the feature and its steps are listed with their origin", () => {
  const [q16] = project.questions;
  if (!q16) throw new Error("fixture without Q16");
  const answer = {
    kind: "text" as const,
    option: null,
    text: "5 Go",
    by: q16.createdBy,
    at: NOW,
    deliveredAt: null,
    deliveredRunId: null,
  };
  const answered = { ...q16, id: "q17", answer };
  expect(featureQuestions({ ...project, questions: [q16, answered] }, "f5", NOW)).toEqual([
    {
      id: "q16",
      title: "Quota par client : 2 Go ou 5 Go ?",
      meta: "Q16 · Produit · hier · SILO-34",
      blocking: false,
    },
  ]);
});

test("a blocking question asked on the feature is listed with its Qn and flagged blocking", () => {
  const [q16] = project.questions;
  if (!q16) throw new Error("fixture without Q16");
  const onFeature = { ...q16, id: "q1", ticketId: "f5", blocking: true, importRef: null, number: 1 };
  expect(featureQuestions({ ...project, questions: [onFeature] }, "f5", NOW)).toEqual([
    {
      id: "q1",
      title: "Quota par client : 2 Go ou 5 Go ?",
      meta: "Q1 · Produit · hier · F5",
      blocking: true,
    },
  ]);
});
