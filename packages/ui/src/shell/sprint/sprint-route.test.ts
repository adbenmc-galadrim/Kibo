import { expect, test } from "bun:test";
import { parseSprintHash, sprintHash, sprintTarget } from "./sprint-route";

test("a sprint has its own address under its project", () => {
  expect(sprintHash("p1", "s42")).toBe("#/p/p1/s/s42");
  expect(parseSprintHash("#/p/p1/s/s42")).toEqual({ projectId: "p1", sprintId: "s42" });
  expect(sprintTarget("p1", "s42")).toEqual({ kind: "sprint", projectId: "p1", sprintId: "s42" });
});

test("a sprint address survives odd characters and refuses a missing id", () => {
  expect(parseSprintHash(sprintHash("p 1", "s/é"))).toEqual({ projectId: "p 1", sprintId: "s/é" });
  expect(parseSprintHash("#/p/p1/s/")).toBeNull();
  expect(parseSprintHash("#/p/p1/t/t1")).toBeNull();
  expect(parseSprintHash("#/p/p1/")).toBeNull();
});
