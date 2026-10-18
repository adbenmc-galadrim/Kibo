import { expect, test } from "bun:test";
import type { ProjectEvent, TicketView } from "@kibo/schema";
import { activityRows } from "./activity-model";
import { indicatorTexts } from "./indicator-texts";
import { build } from "./model-test-kit";
import { type OverviewInput, overviewModel } from "./overview-model";

const SUNDAY = "2026-10-18";

const started = (t: TicketView): TicketView =>
  t.feature === null ? t : { ...t, feature: { ...t.feature, started: true, status: "open" } };

function startFeatures(input: OverviewInput, titles: readonly string[]): OverviewInput {
  return { ...input, tickets: input.tickets.map((t) => (titles.includes(t.title) ? started(t) : t)) };
}

function moveTo(input: OverviewInput, code: string, titles: readonly string[]): OverviewInput {
  const sprint = input.sprints.find((s) => s.code === code);
  if (sprint === undefined) throw new Error(code);
  const tickets = input.tickets.map((t) => (titles.includes(t.title) ? { ...t, sprintId: sprint.id } : t));
  return { ...input, tickets };
}

const F4 = "Saisir un tronçon hors ligne";
const F5 = "Envoyer les photos d'un tronçon";
const F8 = "Valider les soudures par lot";
const F7 = "Rapport de chantier journalier";

test("between two sprints the card names the last sprint and when the next one starts", () => {
  const { model } = build(SUNDAY);
  expect(model.sprint?.title).toBe("Dernier sprint · S42 terminé");
  expect(model.sprint?.dates).toBe("S43 commence lun. 19 oct.");
});

test("between two sprints the next feature to finish comes from the next sprint", () => {
  const { input } = build(SUNDAY);
  const next = overviewModel(moveTo(input, "S43", [F4, F5])).next;
  expect([next?.shortKey, next?.late, next?.from]).toEqual(["F4", false, "S43"]);
});

test("an exceeded limit names the features started ahead of their sprint", () => {
  const { input } = build();
  const model = overviewModel(startFeatures(input, [F8, F7]));
  expect(indicatorTexts(model.indicators).open).toEqual({
    value: "4",
    unit: "/ 2",
    sub: "dépassée : F7, F8 démarrées avant leur sprint · bloquée : F6",
    dot: "red",
  });
  expect(model.sprint?.ahead).toBe("hors sprint : F7 (S44), F8 (S43)");
  const one = overviewModel(startFeatures(input, [F8]));
  expect(one.indicators.ahead).toEqual(["F8"]);
  expect(indicatorTexts({ ...one.indicators, blockedFeatures: [] }).open.sub).toBe(
    "dépassée : F8 démarrée avant son sprint",
  );
});

test("the sprint card no longer repeats the in-progress count", () => {
  const { model } = build();
  expect(model.sprint).not.toHaveProperty("open");
  expect(model.sprint?.ahead).toBeNull();
});

test("the deadlines stretch to the farthest feature in progress, and count the ones beyond", () => {
  const { input } = build();
  const far = startFeatures(input, [F7]);
  expect(overviewModel(far).deadlines.columns.length).toBe(4);
  const base = input.sprints[0];
  if (base === undefined) throw new Error("no sprint");
  const sprints = [
    ...input.sprints,
    { ...base, id: "s50", code: "S50", start: "2026-12-07", end: "2026-12-11" },
    { ...base, id: "s60", code: "S60", start: "2027-02-15", end: "2027-02-19" },
  ];
  const placed = (code: string, title: string) => {
    const tickets = far.tickets.map((t) =>
      t.title === title ? started({ ...t, sprintId: code.toLowerCase() }) : t,
    );
    return { ...far, sprints, tickets };
  };
  const stretched = overviewModel(placed("S50", F8)).deadlines;
  expect(stretched.columns.length).toBe(9);
  expect(stretched.rows.map((r) => r.shortKey)).toContain("F8");
  expect(stretched.later).toBe(0);
  const beyond = overviewModel(placed("S60", F8)).deadlines;
  expect(beyond.columns.length).toBe(12);
  expect(beyond.later).toBe(1);
});

const event = (kind: ProjectEvent["kind"], ticketId: string, data: ProjectEvent["data"]): ProjectEvent => ({
  id: 200,
  projectId: "mock",
  at: Date.parse("2026-10-16T16:00:00"),
  kind,
  ticketId,
  featureId: ticketId,
  source: "user",
  data,
});

test("a question asked on a feature shows the feature once", () => {
  const { input, byTitle } = build();
  const f4 = byTitle(F4);
  const events = [event("question_created", f4.id, { ref: "Q20" })];
  const [row] = activityRows({ ...input, events }, { sources: [], limit: 4 });
  expect([row?.label, row?.key, row?.feature]).toEqual(["Question Q20 posée", null, "F4"]);
});

test("a delivery phase reads as a phase out of twelve", () => {
  const { input } = build();
  const labels = activityRows(input, { sources: ["full-delivery"], limit: 4 }).map((r) => r.label);
  expect(labels).toEqual(["Phase 7/12 · Porte qualité"]);
});
