import { expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type ProjectEvent, type TicketView } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { activityRows } from "./activity-model";
import { manifest } from "./index";
import { featureCellGap, indicatorTexts } from "./indicator-texts";
import { type OverviewInput, overviewModel } from "./overview-model";
import { QUESTION_PAGE, type QuestionRow, questionPage } from "./review-model";
import { NOW, seedOverview, TODAY } from "./test-seed";

const at = (time: string) => Date.parse(`${TODAY}T${time}:00`);
const MINUTE = 60_000;
const DAY = 86_400_000;

function build() {
  let seeded: ReturnType<typeof seedOverview> | undefined;
  const m = createMockSdk(manifest, {
    today: TODAY,
    seed: (run) => {
      seeded = seedOverview(run);
    },
  });
  if (!seeded) throw new Error("seed missing");
  const s = m.snapshot();
  const byTitle = (title: string): TicketView => {
    const found = s.tickets.find((t) => t.title === title);
    if (!found) throw new Error(title);
    return found;
  };
  const sessions = new Map([
    [byTitle("Écran d'envoi hors ligne").id, NOW - 42 * MINUTE],
    [byTitle("Conflits de saisie").id, NOW - 18 * MINUTE],
  ]);
  const tickets = s.tickets.map((t) => {
    const startedAt = sessions.get(t.id);
    return startedAt === undefined ? t : { ...t, session: { tool: "T3 Code", startedAt } };
  });
  const ages = [NOW - 3 * DAY, NOW - DAY - 3_600_000, NOW - 2 * 3_600_000];
  const questions = s.questions.map((q, i) => ({ ...q, createdAt: ages[i] ?? NOW }));
  const f3 = byTitle("Réaffecter un ISO");
  const event = (
    id: number,
    time: string,
    kind: ProjectEvent["kind"],
    ticket: TicketView,
    feature: TicketView | null,
    source: ProjectEvent["source"],
    data: ProjectEvent["data"],
  ): ProjectEvent => ({
    id,
    projectId: "mock",
    at: at(time),
    kind,
    ticketId: ticket.id,
    featureId: feature?.id ?? null,
    source,
    data,
  });
  const f5 = byTitle("Envoyer les photos d'un tronçon");
  const events: ProjectEvent[] = [
    event(1, "13:10", "pr_checks", byTitle("Passage à Expo SDK 54"), null, "git", {
      number: 23,
      checks: "running",
    }),
    event(2, "13:30", "pr_review", byTitle("Conflits de saisie"), null, "git", {
      number: 20,
      review: "changes_requested",
    }),
    event(3, "14:36", "pr_merged", byTitle("Démo client"), f3, "git", { number: 18, delivered: "F3" }),
    { ...event(4, "14:40", "batch_proposed", f5, null, "project-agent", { seq: 7 }), ticketId: null },
    event(5, "14:51", "step_set", byTitle("Écran d'envoi hors ligne"), f5, "full-delivery", { step: 7 }),
    event(6, "15:04", "pr_opened", byTitle("Route d'envoi des photos"), f5, "git", { number: 22 }),
  ];
  const input: OverviewInput = {
    tickets,
    links: s.links,
    sprints: s.sprints,
    questions,
    events,
    ciRuns: [],
    recipients: DEFAULT_RECIPIENTS,
    workflow: s.workflow,
    tracking: null,
    today: TODAY,
    now: NOW,
  };
  return { input, model: overviewModel(input), byTitle, seeded };
}

test("the five indicators read as the mockup", () => {
  const { model } = build();
  expect(indicatorTexts(model.indicators)).toEqual({
    features: {
      value: "3",
      unit: "livrées sur 9",
      cells: ["delivered", "delivered", "delivered", "open", "open", "todo", "todo", "todo", "todo"],
    },
    sprint: { value: "S42", unit: "finit ce soir", sub: "Terrain hors ligne" },
    open: { value: "2", unit: "sur 2 max", sub: "limite atteinte", dot: "amber" },
    review: { value: "3", unit: "PR", sub: "#20 · #22 · #23" },
    questions: { value: "3", unit: "ouvertes", sub: "Q14 bloque F6", dot: "red" },
  });
});

test("a finished sprint that stays current says when it ended", () => {
  const { model } = build();
  const sprint = { code: "S42", name: "Terrain hors ligne", ending: { ended: "2026-10-16" } };
  expect(indicatorTexts({ ...model.indicators, sprint }).sprint).toEqual({
    value: "S42",
    unit: "terminé le 16 oct.",
    sub: "Terrain hors ligne",
  });
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
  expect(model.deadlines.rows[1]?.slipTo?.code).toBe("S43");
  expect(model.deadlines.rows[2]?.blockedBy).toBe("Q14");
  expect(model.deadlines.columns.map((c) => c.sprint?.code ?? null)).toEqual(["S42", "S43", "S44", null]);
  expect(model.deadlines.today).toBe(4 / 28);
});

test("the current sprint lists its features, the open badge and the limit note", () => {
  const { model } = build();
  const sprint = model.sprint;
  expect(sprint?.title).toBe("Sprint S42 · Terrain hors ligne");
  expect(sprint?.dates).toBe("12–16 oct.");
  expect(sprint?.open).toEqual({ text: "2/2 ouvertes", full: true });
  expect(sprint?.rows.map((r) => [r.shortKey, r.title, r.state, r.steps])).toEqual([
    ["F3", "Réaffecter un ISO", "delivered", "4/4"],
    ["F4", "Saisir un tronçon hors ligne", "open", "3/5"],
    ["F5", "Envoyer les photos d'un tronçon", "late", "1/5"],
  ]);
  expect(sprint?.note).toBe("Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5.");
});

test("the next feature to finish is the most advanced one of the sprint", () => {
  const { model, byTitle } = build();
  const next = model.next;
  expect([next?.shortKey, next?.title, next?.steps]).toEqual(["F4", "Saisir un tronçon hors ligne", "3/5"]);
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
    ["Un ISO réaffecté garde-t-il ses photos ?", "F6", "Q14 · Client · il y a 3 j", true],
    ["Quota par affaire : 2 Go ou 5 Go ?", "F5", "Q16 · Produit · hier", false],
    ["Un rapport par chef de chantier ou par affaire ?", "F7", "Q17 · Client · il y a 2 h", false],
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
    ["14:51", "Étape 7 · Porte qualité", "F5", false],
    ["14:40", "Suivi mis à jour · lot n° 7 proposé", null, true],
    ["14:36", "PR #18 fusionnée · F3 livrée", "F3", false],
  ]);
  expect(activityRows(input, { sources: ["full-delivery"], limit: 4 }).map((r) => r.label)).toEqual([
    "Étape 7 · Porte qualité",
  ]);
  expect(activityRows(input, { sources: ["git"], limit: 50 }).length).toBe(4);
});
