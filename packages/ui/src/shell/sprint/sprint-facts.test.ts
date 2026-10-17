import { expect, test } from "bun:test";
import { sprintFeatures, sprintTiming } from "./sprint-facts";
import { sprintProject, TODAY } from "./sprint-fixture";

const project = sprintProject();
const [s41, s42, s43] = project.sprints;
if (!s41 || !s42 || !s43) throw new Error("fixture without sprints");

test("a sprint lists its features in rank order with one step status per step", () => {
  const rows = sprintFeatures(project, s42);
  expect(rows.map((r) => r.shortKey)).toEqual(["F3", "F4", "F5"]);
  const statuses = (i: number) => rows[i]?.steps.map((s) => s.statusId);
  expect(rows[0]?.status).toBe("delivered");
  expect(statuses(0)).toEqual(["done"]);
  expect(statuses(2)).toEqual(["done", "in_review", "in_progress", "todo", "todo"]);
});

test("the timing says when the sprint ends or starts", () => {
  expect(sprintTiming(s42, TODAY)).toEqual({ kind: "endsToday" });
  expect(sprintTiming(s42, "2026-10-13")).toEqual({ kind: "endsIn", days: 3 });
  expect(sprintTiming(s41, TODAY)).toEqual({ kind: "ended", end: "2026-10-09" });
  expect(sprintTiming(s43, TODAY)).toEqual({ kind: "starts", start: "2026-10-19" });
});
