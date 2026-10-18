import { expect, test } from "bun:test";
import { currentSprint } from "@kibo/schema";
import { indicatorTexts } from "./indicator-texts";
import { build } from "./model-test-kit";
import { sprintOf } from "./sprint-model";
import { TODAY } from "./test-seed";

const SATURDAY = "2026-10-17";
const SUNDAY = "2026-10-18";
const MONDAY = "2026-10-19";

test("between two sprints, the finished sprint stays current and says what remains", () => {
  const sprint = build(SATURDAY).model.sprint;
  expect(sprint?.title).toBe("Sprint S42 · Terrain hors ligne");
  expect(sprint?.lingering).toBe(true);
  expect(sprint?.dates).toBe("terminé le 16 oct. · reste 2");
  expect(build(SUNDAY).model.sprint?.dates).toBe("terminé le 16 oct. · reste 2");
  expect(build().model.sprint?.lingering).toBe(false);
});

test("on Monday the next sprint is current", () => {
  const sprint = build(MONDAY).model.sprint;
  expect(sprint?.sprint.code).toBe("S43");
  expect(sprint?.lingering).toBe(false);
  expect(sprint?.dates).toBe("19–23 oct. · en cours");
});

test("the sprint of the card is the shared current sprint", () => {
  for (const today of [TODAY, SATURDAY, SUNDAY, MONDAY]) {
    const { input } = build(today);
    expect(sprintOf(input)?.id).toBe(currentSprint(input.sprints, today)?.id);
  }
});

test("no feature is late while its sprint runs", () => {
  const { model } = build();
  expect(model.late).toEqual([]);
  expect(model.indicators.features.late).toBe(0);
});

test("once the sprint is over, its unfinished features are late, oldest sprint first", () => {
  const { model } = build(SUNDAY);
  expect(
    model.late.map((r) => [r.shortKey, r.title, r.sprintCode, r.sprintNote, r.remaining, r.steps]),
  ).toEqual([
    ["F4", "Saisir un tronçon hors ligne", "S42", "· terminé le 16 oct.", "reste 1 étape", "3/5"],
    ["F5", "Envoyer les photos d'un tronçon", "S42", "· terminé le 16 oct.", "reste 4 étapes", "1/5"],
  ]);
  expect(model.late[1]?.tones.length).toBe(5);
  expect(indicatorTexts(model.indicators).features).toMatchObject({ sub: "2 en retard", tone: "red" });
});

test("the in-progress indicator names the blocked features", () => {
  const { model } = build();
  expect(model.indicators.blockedFeatures).toEqual(["F6"]);
  expect(indicatorTexts(model.indicators).open).toEqual({
    value: "2",
    unit: "/ 2",
    sub: "limite atteinte · bloquée : F6",
    dot: "red",
  });
  const blocked = { ...model.indicators, blockedFeatures: ["F6", "F8"] };
  expect(indicatorTexts(blocked).open.sub).toBe("limite atteinte · bloquées : F6, F8");
});

test("an empty project reads as the Pour commencer mockup", () => {
  const empty = {
    features: { delivered: 0, total: 0, cells: [], late: 0 },
    sprint: { next: { code: "S1", start: "2026-10-19" } },
    open: { count: 0, limit: 2, level: "under" as const },
    review: { count: 0, numbers: [] },
    questions: { open: 0, blocking: null },
    blocked: { count: 0 },
    blockedFeatures: [],
    atRisk: 0,
    remaining: 0,
  };
  expect(indicatorTexts(empty)).toEqual({
    features: { value: "0", unit: "livrées sur 0", cells: [], sub: "aucune pour l'instant" },
    sprint: { value: "—", unit: "", sub: "S1 commence le lun. 19 oct." },
    open: { value: "0", unit: "/ 2", sub: "aucune en cours" },
    review: { value: "0", unit: "PR", sub: "aucune PR" },
    questions: { value: "0", unit: "ouvertes", sub: "aucune question" },
  });
});
