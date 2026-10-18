import { expect, test } from "bun:test";
import type { Sprint } from "@kibo/schema";
import { inCurrentSprint } from "./sprint-filter";

const sprint = (id: string, start: string, end: string): Sprint => ({ id, code: id, name: id, start, end });
const SPRINTS = [
  sprint("S41", "2026-10-05", "2026-10-09"),
  sprint("S42", "2026-10-12", "2026-10-16"),
  sprint("S43", "2026-10-19", "2026-10-23"),
];
const inS = (effectiveSprintId: string | null) => ({ effectiveSprintId });

test("a ticket is in the current sprint through its effective sprint", () => {
  expect(inCurrentSprint(inS("S42"), SPRINTS, "2026-10-16")).toBe(true);
  expect(inCurrentSprint(inS("S43"), SPRINTS, "2026-10-16")).toBe(false);
  expect(inCurrentSprint(inS(null), SPRINTS, "2026-10-16")).toBe(false);
});

test("between two sprints, the finished one stays current", () => {
  expect(inCurrentSprint(inS("S42"), SPRINTS, "2026-10-17")).toBe(true);
  expect(inCurrentSprint(inS("S43"), SPRINTS, "2026-10-17")).toBe(false);
  expect(inCurrentSprint(inS("S43"), SPRINTS, "2026-10-19")).toBe(true);
});

test("before any sprint, nothing is in the current sprint", () => {
  expect(inCurrentSprint(inS("S41"), SPRINTS, "2026-10-01")).toBe(false);
  expect(inCurrentSprint(inS(null), [], "2026-10-16")).toBe(false);
});
