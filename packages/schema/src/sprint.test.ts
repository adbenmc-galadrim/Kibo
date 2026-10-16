import { expect, test } from "bun:test";
import { currentSprint, nextSprint, Sprint, SprintPatch, sortSprints, sprintState } from "./sprint";

const S41 = { id: "s41", name: "Accès", start: "2026-10-05", end: "2026-10-09" };
const S42 = { id: "s42", name: "Terrain hors ligne", start: "2026-10-12", end: "2026-10-16" };
const S43 = { id: "s43", name: "Import et soudures", start: "2026-10-19", end: "2026-10-23" };
const S44 = { id: "s44", name: "Rapports", start: "2026-10-26", end: "2026-10-30" };

test("a sprint has a name of at most 60 characters and ordered ISO dates", () => {
  expect(Sprint.parse(S42)).toEqual(S42);
  expect(Sprint.safeParse({ ...S42, start: "2026-10-17" }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, name: "x".repeat(61) }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, name: "   " }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, start: "2026-1-5" }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, start: "2026-10-16", end: "2026-10-16" }).success).toBe(true);
});

test("a sprint patch is strict and validates each field", () => {
  expect(SprintPatch.parse({ name: " Rapports " })).toEqual({ name: "Rapports" });
  expect(SprintPatch.safeParse({ end: "16/10/2026" }).success).toBe(false);
  expect(SprintPatch.safeParse({ id: "x" }).success).toBe(false);
});

test("the sprint state follows the dates, both bounds included", () => {
  expect(sprintState(S42, "2026-10-11")).toBe("planned");
  expect(sprintState(S42, "2026-10-12")).toBe("current");
  expect(sprintState(S42, "2026-10-16")).toBe("current");
  expect(sprintState(S42, "2026-10-17")).toBe("done");
});

test("sprints sort by start then name", () => {
  const twin = { ...S43, id: "s43b", name: "Abc" };
  expect(sortSprints([S44, S43, twin, S41, S42]).map((s) => s.id)).toEqual([
    "s41",
    "s42",
    "s43b",
    "s43",
    "s44",
  ]);
});

test("the current sprint is the current one that started last, the next is the first planned", () => {
  const overlap = { id: "s42b", name: "Rattrapage", start: "2026-10-14", end: "2026-10-20" };
  expect(currentSprint([S41, S42, S43, S44], "2026-10-16")?.id).toBe("s42");
  expect(currentSprint([overlap, S42, S43], "2026-10-16")?.id).toBe("s42b");
  expect(currentSprint([S41, S43], "2026-10-16")).toBeNull();
  expect(nextSprint([S44, S41, S43, S42], "2026-10-16")?.id).toBe("s43");
  expect(nextSprint([S41, S42], "2026-10-16")).toBeNull();
});
