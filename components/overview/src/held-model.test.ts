import { expect, test } from "bun:test";
import { heldRows } from "./held-model";
import { indicatorTexts } from "./indicator-texts";
import { build } from "./model-test-kit";
import { TODAY } from "./test-seed";

const keys = (model: ReturnType<typeof build>["model"], title: string) =>
  model.sprint?.rows.find((r) => r.title === title);

test("one row per reason, the oldest first then by name, its steps by key and how many wait on them", () => {
  const { input, byTitle } = build(TODAY, true);
  const key = (title: string) => byTitle(title).keyLabel;
  expect(heldRows(input.tickets)).toEqual([
    { reason: "Règle de fusion à valider par le client", keys: [key("Conflits de saisie")], dependents: 0 },
    {
      reason: "Serveur MinIO de recette indisponible",
      keys: [key("Écran d'envoi hors ligne"), key("PDF")],
      dependents: 2,
    },
  ]);
});

test("the indicator counts the steps put on hold, not the ones waiting on them", () => {
  const { model } = build(TODAY, true);
  expect(model.indicators.held).toBe(3);
  expect(indicatorTexts(model.indicators).features).toMatchObject({ value: "4", held: "3 en attente" });
});

test("a step on hold leaves the counts, the segments and the risk of its feature", () => {
  const { model } = build(TODAY, true);
  const f4 = keys(model, "Saisir un constat hors ligne");
  expect(f4).toMatchObject({ state: "delivered", steps: "3/4", held: 1, risk: false });
  expect(f4?.tones).toHaveLength(4);
  const f5 = keys(model, "Envoyer les photos d'un constat");
  expect(f5).toMatchObject({ state: "open", steps: "1/2", held: 3, risk: false });
  expect(f5?.tones).toHaveLength(2);
  expect(model.next?.remaining.map((s) => s.title)).toEqual(["Route d'envoi des photos"]);
  const f5Row = model.deadlines.rows.find((r) => r.title === "Envoyer les photos d'un constat");
  expect(f5Row?.cells).toHaveLength(2);
  expect(f5Row?.tone).toBeUndefined();
});

test("without any hold, nothing changes: no row, no count, every step in its feature", () => {
  const { model, input } = build();
  expect(heldRows(input.tickets)).toEqual([]);
  expect(model.held).toEqual([]);
  expect(model.indicators.held).toBe(0);
  expect(indicatorTexts(model.indicators).features.held).toBeUndefined();
  expect(model.sprint?.rows.map((r) => [r.steps, r.tones.length, r.held, r.risk])).toEqual([
    ["4/4", 4, 0, false],
    ["3/5", 5, 0, true],
    ["1/5", 5, 0, true],
  ]);
});
