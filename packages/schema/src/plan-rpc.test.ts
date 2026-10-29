import { expect, test } from "bun:test";
import { isPlanRequest, PLAN_METHODS } from "./plan-rpc";
import { RpcRequest } from "./rpc";

const actions = [
  { id: 1, why: "", type: "createTicket", ref: "new:1", title: "Tournée et dépôt", feature: true },
];

test("previewPlan and applyPlan are rpc requests", () => {
  expect([...PLAN_METHODS].sort()).toEqual(["applyPlan", "previewPlan"]);
  for (const method of ["previewPlan", "applyPlan"]) {
    const req = RpcRequest.parse({ method, projectId: "p1", actions });
    expect(isPlanRequest(req)).toBe(true);
  }
  expect(RpcRequest.safeParse({ method: "applyPlan", projectId: "p1", actions: [] }).success).toBe(false);
  expect(
    RpcRequest.safeParse({
      method: "previewPlan",
      projectId: "p1",
      actions: [{ id: 1, why: "", type: "cancelRun", runId: "r1" }],
    }).success,
  ).toBe(false);
  expect(isPlanRequest(RpcRequest.parse({ method: "getProjectAgent", projectId: "p1" }))).toBe(false);
});
