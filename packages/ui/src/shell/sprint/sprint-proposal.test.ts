import { expect, test } from "bun:test";
import { batch, moveF5, moveF7, remindQ14, sprintProject } from "./sprint-fixture";
import { pendingSprintActions } from "./sprint-proposal";

const project = sprintProject();
const s42 = project.sprints[1];
if (!s42) throw new Error("fixture without S42");

test("the pending batch's setSprint actions on the sprint's features make the proposal", () => {
  const proposal = pendingSprintActions([batch([moveF5, remindQ14, moveF7])], s42, project.tickets);
  expect(proposal).toEqual({ batchId: "b7", seq: 7, moves: [{ actionId: 1, shortKey: "F5", to: "S43" }] });
});

test("no pending batch, or none aimed at this sprint, makes no proposal", () => {
  expect(pendingSprintActions([], s42, project.tickets)).toBeNull();
  expect(pendingSprintActions([batch([moveF5], "applied")], s42, project.tickets)).toBeNull();
  expect(pendingSprintActions([batch([remindQ14, moveF7])], s42, project.tickets)).toBeNull();
});
