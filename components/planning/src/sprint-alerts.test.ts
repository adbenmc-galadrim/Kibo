import { expect, test } from "bun:test";
import { mergeSprintAlerts } from "./sprint-alerts";

test("wontHold, lateBy and limit are merged in that order with ·", () => {
  expect(
    mergeSprintAlerts({
      lateBy: ["F2 en retard (1 étape restante)"],
      limit: "3 en cours pour une limite de 2",
      wontHold: ["F5 ne tiendra pas (4 étapes restantes)", "F4 ne tiendra pas (1 étape restante)"],
    }),
  ).toBe(
    "F5 ne tiendra pas (4 étapes restantes) · F4 ne tiendra pas (1 étape restante) · F2 en retard (1 étape restante) · 3 en cours pour une limite de 2",
  );
});

test("no warning gives null", () => {
  expect(mergeSprintAlerts({ wontHold: [], lateBy: [], limit: null })).toBeNull();
});
