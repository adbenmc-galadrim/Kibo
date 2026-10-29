import { expect, test } from "bun:test";
import { INBOX_ID, PLAN_METHODS, type PlanAction } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { planRpc } from "./plan-rpc";
import type { PlanService } from "./plan-service";

const actions: PlanAction[] = [{ id: 1, why: "", type: "createTicket", ref: "new:1", title: "Tournée" }];

function recordingService(calls: string[]): PlanService {
  return {
    preview: (projectId, given) => {
      calls.push(`preview:${projectId}:${given.length}`);
      return { ok: true, keys: { "new:1": "SILO-1" } };
    },
    apply: async (projectId, given) => {
      calls.push(`apply:${projectId}:${given.length}`);
      return { problems: [], results: [], created: [], stoppedAt: null };
    },
  };
}

test("the extension serves previewPlan and applyPlan by delegating to the service", async () => {
  const calls: string[] = [];
  const rpc = planRpc(recordingService(calls));
  expect(new Set<string>(rpc.methods)).toEqual(new Set(PLAN_METHODS));
  expect(await rpc.handle({ method: "previewPlan", projectId: "p1", actions }, LOCAL_CONTEXT)).toEqual({
    ok: true,
    keys: { "new:1": "SILO-1" },
  });
  expect(await rpc.handle({ method: "applyPlan", projectId: "p1", actions }, LOCAL_CONTEXT)).toEqual({
    problems: [],
    results: [],
    created: [],
    stoppedAt: null,
  });
  expect(calls).toEqual(["preview:p1:1", "apply:p1:1"]);
});

test("a remote session, the inbox and another method are refused before the service", async () => {
  const calls: string[] = [];
  const rpc = planRpc(recordingService(calls));
  await expect(
    rpc.handle({ method: "applyPlan", projectId: "p1", actions }, { sessionHash: "h", remote: true }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    rpc.handle({ method: "previewPlan", projectId: INBOX_ID, actions }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(rpc.handle({ method: "getAgents" }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INTERNAL",
  });
  expect(calls).toEqual([]);
});
