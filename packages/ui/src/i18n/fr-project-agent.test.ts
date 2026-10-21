import { expect, test } from "bun:test";
import { frProjectAgent } from "./fr-project-agent";
import { frSignals } from "./fr-signals";

const keys = (o: object) => Object.keys(o);

test("the panel texts keep nothing of the Suivi, the tabs, the menu nor the past list", () => {
  for (const gone of ["titleSuffix", "tabs", "status", "tracking", "menu", "recap", "reminder", "profile"])
    expect(keys(frProjectAgent)).not.toContain(gone);
  expect(keys(frProjectAgent.compose)).not.toContain("hint");
  expect(keys(frProjectAgent.past)).toEqual(["banner", "back"]);
  expect(frProjectAgent.open).toBe("Ouvrir l'agent de projet");
});

test("the signal texts keep nothing of the signal box", () => {
  expect(keys(frSignals)).not.toContain("box");
  expect(keys(frSignals.button)).toEqual(["signals"]);
  expect(keys(frSignals.wakeup)).toEqual(["label", "event", "answered"]);
});
