import { expect, test } from "bun:test";
import { activityRows } from "./activity-model";
import { featureCellGap, indicatorTexts } from "./indicator-texts";
import { build } from "./model-test-kit";
import { overviewModel } from "./overview-model";
import { QUESTION_PAGE, type QuestionRow, questionPage } from "./review-model";

test("the five indicators read as the mockup", () => {
  const { model } = build();
  expect(indicatorTexts(model.indicators)).toEqual({
    features: {
      value: "3",
      unit: "livrées sur 9",
      cells: ["delivered", "delivered", "delivered", "open", "open", "todo", "todo", "todo", "todo"],
      sub: "2 à risque",
      tone: "amber",
    },
    sprint: { value: "S42", unit: "Saisie hors ligne", sub: "se termine aujourd'hui" },
    open: { value: "2", unit: "/ 2", sub: "limite · bloquée : F6", dot: "red" },
    review: { value: "3", unit: "PR", sub: "#20 · #22 · #23" },
    questions: { value: "3", unit: "ouvertes", sub: "Q14 bloque F6", dot: "red" },
  });
});

test("a finished sprint that stays current says when it ended", () => {
  const { model } = build();
  const sprint = { code: "S42", name: "Saisie hors ligne", ending: { ended: "2026-10-16" } };
  expect(indicatorTexts({ ...model.indicators, sprint, remaining: 2 }).sprint).toEqual({
    value: "S42",
    unit: "Saisie hors ligne",
    sub: "terminé le 16 oct. · reste 2",
  });
  const running = { ...sprint, ending: { days: 3 } };
  expect(indicatorTexts({ ...model.indicators, sprint: running }).sprint.sub).toBe("en cours");
});

test("the sessions in progress, longest first, with their delivery step and duration", () => {
  const { model } = build();
  expect(model.now.map((r) => [r.feature, r.title, r.step, r.duration])).toEqual([
    ["F5", "Écran d'envoi hors ligne", "7 · Porte qualité", "42 min"],
    ["F4", "Conflits de saisie", "9 · Review", "18 min"],
  ]);
  expect(model.now[0]?.segments.filter((s) => s === "done").length).toBe(7);
  expect(model.now[0]?.segments[7]).toBe("current");
  expect(model.now[0]?.segments.length).toBe(12);
});

test("the deadlines cover four weeks from the current sprint", () => {
  const { model } = build();
  expect(model.deadlines.rows.map((r) => r.shortKey)).toEqual(["F4", "F5", "F6", "F8", "F7"]);
  expect(model.deadlines.rows[1]?.slipTo).toBeNull();
  expect(build("2026-10-17").model.deadlines.rows[1]?.slipTo?.code).toBe("S43");
  expect(model.deadlines.rows[2]?.blockedBy).toBe("Q14");
  expect(model.deadlines.columns.map((c) => c.sprint?.code ?? null)).toEqual(["S42", "S43", "S44", null]);
  expect(model.deadlines.today).toBe(4 / 28);
});

test("the current sprint lists its features and the limit note", () => {
  const { model } = build();
  const sprint = model.sprint;
  expect(sprint?.title).toBe("Sprint S42 · Saisie hors ligne");
  expect(sprint?.dates).toBe("12–16 oct.");
  expect(sprint?.rows.map((r) => [r.shortKey, r.title, r.state, r.steps, r.risk, r.slipped])).toEqual([
    ["F3", "Réaffecter un box", "delivered", "4/4", false, null],
    ["F4", "Saisir un constat hors ligne", "open", "3/5", true, null],
    ["F5", "Envoyer les photos d'un constat", "open", "1/5", true, null],
  ]);
  expect(sprint?.note).toBe("Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5.");
});

test("the next feature to finish is the most advanced one of the sprint", () => {
  const { model, byTitle } = build();
  const next = model.next;
  expect([next?.shortKey, next?.title, next?.steps]).toEqual(["F4", "Saisir un constat hors ligne", "3/5"]);
  expect(next?.remaining.map((s) => [s.title, s.tone, s.changes])).toEqual([
    ["Conflits de saisie", "review", true],
    ["Démo client", "todo", false],
  ]);
  const step = byTitle("Conflits de saisie");
  expect(next?.deliver).toEqual({
    ticketId: step.id,
    key: step.keyLabel,
    command: `/full-delivery ${step.keyLabel}`,
  });
});

test("the pull requests in review, latest event first, with their review or CI", () => {
  const { model } = build();
  expect(model.review.map((r) => [r.number, r.title, r.feature, r.state])).toEqual([
    [22, "Route d'envoi des photos", "F5", "ok"],
    [20, "Conflits de saisie", "F4", "changes"],
    [23, "Passage à Expo SDK 54", null, "running"],
  ]);
});

test("the open questions, blocking first, with reference, recipient and age", () => {
  const { model } = build();
  expect(model.questions.map((q) => [q.title, q.feature, q.meta, q.blocking])).toEqual([
    ["Un box réaffecté garde-t-il ses photos ?", "F6", "Q14 · Client · il y a 3 j", true],
    ["Quota par client : 2 Go ou 5 Go ?", "F5", "Q16 · Produit · hier", false],
    ["Un rapport par chef de centre ou par client ?", "F7", "Q17 · Client · il y a 2 h", false],
  ]);
});

const row = (n: number, blocking = false): QuestionRow => ({
  id: `q${n}`,
  title: `Question ${n}`,
  feature: null,
  meta: "",
  blocking,
});

test("the questions show five at a time and count the hidden ones", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i + 1));
  expect(QUESTION_PAGE).toBe(5);
  const first = questionPage(rows, QUESTION_PAGE);
  expect(first.rows.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
  expect(first.more).toBe(7);
  expect(questionPage(rows, 10).more).toBe(2);
  const last = questionPage(rows, 15);
  expect(last.rows.length).toBe(12);
  expect(last.more).toBe(0);
  expect(questionPage(rows.slice(0, 3), QUESTION_PAGE)).toEqual({ rows: rows.slice(0, 3), more: 0 });
});

test("the first page keeps the blocking questions ahead of the others, in rank order", () => {
  const { input } = build();
  const [sample] = input.questions;
  if (sample === undefined) throw new Error("no question");
  const ask = (id: string, blocking: boolean) => ({ ...sample, id, blocking });
  const questions = [
    ask("p1", false),
    ask("p2", false),
    ask("p3", false),
    ask("p4", false),
    ask("b1", true),
    ask("p5", false),
    ask("b2", true),
  ];
  const rows = overviewModel({ ...input, questions }).questions;
  expect(questionPage(rows, QUESTION_PAGE).rows.map((q) => q.id)).toEqual(["b1", "b2", "p1", "p2", "p3"]);
});

test("the feature cells tighten their gap beyond twelve features", () => {
  expect(featureCellGap(9)).toBe(3);
  expect(featureCellGap(12)).toBe(3);
  expect(featureCellGap(13)).toBe(2);
});

test("the activity shows the four latest events, and filters by source", () => {
  const { input } = build();
  const rows = activityRows(input, { sources: [], limit: 4 });
  expect(rows.map((r) => [r.time, r.label, r.feature, r.agent])).toEqual([
    ["15:04", "PR #22 ouverte", "F5", false],
    ["14:51", "Phase 7/12 · Porte qualité", "F5", false],
    ["14:40", "Suivi mis à jour · lot n° 7 proposé", null, true],
    ["14:36", "PR #18 fusionnée · F3 livrée", "F3", false],
  ]);
  expect(activityRows(input, { sources: ["full-delivery"], limit: 4 }).map((r) => r.label)).toEqual([
    "Phase 7/12 · Porte qualité",
  ]);
  expect(activityRows(input, { sources: ["git"], limit: 50 }).length).toBe(4);
});
