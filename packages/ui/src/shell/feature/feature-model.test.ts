import { expect, test } from "bun:test";
import { featureActivity, featureQuestions } from "./feature-feed";
import { featureDependencies } from "./feature-links";
import { featureBadge, nextToDeliver, sprintFacts, stepModels } from "./feature-model";
import { emisFeatureProject, NOW, SESSION_RUN, SPRINTS } from "./fixture";
import { sprintCode } from "./sprint-label";

const project = emisFeatureProject();
const f5 = () => {
  const t = project.tickets.find((x) => x.id === "f5");
  if (!t) throw new Error("fixture without F5");
  return t;
};

test("the steps follow the dependency order and carry their session", () => {
  const steps = stepModels(project, "f5", [SESSION_RUN], NOW);
  expect(steps.map((s) => [s.index, s.key, s.statusId])).toEqual([
    [1, "EMIS-31", "done"],
    [2, "EMIS-32", "in_review"],
    [3, "EMIS-33", "in_progress"],
    [4, "EMIS-34", "todo"],
    [5, "EMIS-35", "todo"],
  ]);
  expect(steps[2]?.session).toEqual({ agent: "T3 Code", minutes: 42 });
  expect(steps.filter((s) => s.session !== null)).toHaveLength(1);
  expect(steps[3]?.blockedBy).toEqual(["EMIS-33"]);
});

test("a finished run is not a session", () => {
  const steps = stepModels(project, "f5", [{ ...SESSION_RUN, state: "done" }], NOW);
  expect(steps.every((s) => s.session === null)).toBe(true);
});

test("the next step to deliver is the first one not started", () => {
  const steps = stepModels(project, "f5", [], NOW);
  expect(nextToDeliver(steps)?.key).toBe("EMIS-34");
  expect(nextToDeliver(steps.map((s) => ({ ...s, statusId: "done" as const })))).toBeNull();
});

test("a sprint ending today with steps left warns that the feature will not fit", () => {
  const facts = sprintFacts(project, f5(), "2026-10-16");
  expect(facts.sprint?.id).toBe("s42");
  expect(facts.following?.id).toBe("s43");
  expect(facts.warning).toEqual({ kind: "wontFit", remaining: 4 });
  expect(featureBadge(f5().feature, facts.warning)).toBe("late");
});

const withStatus = (status: "open" | "late") => {
  const state = f5().feature;
  if (!state) throw new Error("F5 is a feature");
  return { ...f5(), feature: { ...state, status } };
};

test("before the last day of the sprint nothing warns and the feature stays open", () => {
  const open = withStatus("open");
  const facts = sprintFacts(project, open, "2026-10-14");
  expect(facts.warning).toBeNull();
  expect(featureBadge(open.feature, facts.warning)).toBe("open");
});

test("late on the last day of its sprint (end ≤ today), the feature still fits nowhere else", () => {
  const late = withStatus("late");
  const facts = sprintFacts(project, late, "2026-10-16");
  expect(facts.warning).toEqual({ kind: "wontFit", remaining: 4 });
  expect(featureBadge(late.feature, facts.warning)).toBe("late");
});

test("a late feature says its sprint is over", () => {
  const late = withStatus("late");
  const sprints = project.sprints.map((s) => (s.id === "s42" ? { ...s, state: "done" as const } : s));
  const facts = sprintFacts({ ...project, sprints }, late, "2026-10-19");
  expect(facts.warning).toEqual({ kind: "over", remaining: 4 });
  expect(featureBadge(late.feature, facts.warning)).toBe("late");
});

test("an unplanned feature has no sprint and nothing to move", () => {
  const facts = sprintFacts(project, { ...f5(), sprintId: null }, "2026-10-16");
  expect(facts).toEqual({ sprint: null, following: null, warning: null });
});

test("dependencies between features are read on the roots and on their steps", () => {
  const extra = { id: "l9", from: "e71", to: "e31", type: "blocks" as const };
  const deps = featureDependencies({ ...project, links: [...project.links, extra] }, "f5");
  expect(deps.waits).toEqual([
    { id: "f3", label: "F3", title: "Réaffecter un ISO", delivered: true, sprint: "S42" },
    { id: "f7", label: "F7", title: "Rapport de chantier", delivered: false, sprint: "S44" },
  ]);
  expect(deps.unblocks).toEqual([
    { id: "f7", label: "F7", title: "Rapport de chantier", delivered: false, sprint: "S44" },
  ]);
});

test("the activity lists PRs and delivery steps, newest first", () => {
  const steps = stepModels(project, "f5", [], NOW);
  expect(featureActivity(steps, NOW)).toEqual([
    { kind: "pr_opened", text: "PR #22 ouverte · EMIS-32", time: "15:04" },
    { kind: "step", text: "Étape 7 · Porte qualité · EMIS-33", time: "14:51" },
    { kind: "pr_merged", text: "PR #19 fusionnée · EMIS-31", time: "hier" },
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
    { id: "q16", title: "Quota par affaire : 2 Go ou 5 Go ?", meta: "Q16 · Produit · hier · EMIS-34" },
  ]);
});

test("a sprint shows its code, never a piece of its name", () => {
  const [s41] = SPRINTS;
  if (!s41) throw new Error("fixture without S41");
  expect(sprintCode(s41)).toBe("S41");
});
