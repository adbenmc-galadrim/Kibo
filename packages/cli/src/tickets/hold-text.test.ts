import { expect, test } from "bun:test";
import { dayText, holdLine } from "./hold-text";

test("says the reason and the day of an own hold", () => {
  const own = { source: "own" as const, key: "SILO-33", reason: "R", since: "2026-10-16" };
  expect(holdLine(own)).toBe("En attente : R · depuis le 16 oct.");
});

test("names the step a dependent hold waits on", () => {
  const dependency = { source: "dependency" as const, key: "SILO-33", reason: "R", since: "2026-10-16" };
  expect(holdLine(dependency)).toBe("En attente de SILO-33");
});

test("writes a day with the short French month, without leading zero", () => {
  expect(dayText("2026-01-05")).toBe("5 janv.");
  expect(dayText("2026-08-31")).toBe("31 août");
  expect(dayText("2026-12-01")).toBe("1 déc.");
});
