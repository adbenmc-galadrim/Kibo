import { expect, test } from "bun:test";
import { SPRINTS } from "../commands/tickets-test-kit";
import { findSprint } from "./find-sprint";

test("finds a sprint by its id", () => {
  expect(findSprint(SPRINTS, "s41")?.code).toBe("S41");
});

test("finds a sprint by its code, whatever the case", () => {
  expect(findSprint(SPRINTS, "s42")?.id).toBe("s42");
  expect(findSprint(SPRINTS, " S42 ")?.id).toBe("s42");
});

test("finds a sprint by its exact name, whatever the case", () => {
  expect(findSprint(SPRINTS, "saisie hors ligne")?.id).toBe("s42");
});

test("an unknown sprint gives null", () => {
  expect(findSprint(SPRINTS, "S99")).toBeNull();
  expect(findSprint(SPRINTS, "Saisie")).toBeNull();
});
