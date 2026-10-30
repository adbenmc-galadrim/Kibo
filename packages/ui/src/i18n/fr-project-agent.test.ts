import { expect, test } from "bun:test";
import { frProjectAgent } from "./fr-project-agent";
import { frWakeup } from "./fr-wakeup";

const keys = (o: object) => Object.keys(o);

test("the panel texts keep nothing of the Suivi, the tabs, the menu nor the past list", () => {
  for (const gone of [
    "titleSuffix",
    "tabs",
    "status",
    "tracking",
    "menu",
    "recap",
    "reminder",
    "profile",
    "sendFailed",
  ])
    expect(keys(frProjectAgent)).not.toContain(gone);
  expect(keys(frProjectAgent.compose)).not.toContain("hint");
  expect(keys(frProjectAgent.past)).toEqual(["banner", "back"]);
  expect(frProjectAgent.open).toBe("Ouvrir l'agent de projet");
});

test("the wakeup texts keep nothing of the signals", () => {
  expect(keys(frWakeup)).toEqual(["label", "event", "answered"]);
});
