import { expect, test } from "bun:test";
import { INBOX_ID, PROJECT_AGENT_METHODS, type RpcRequest } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { projectAgentRpc } from "./rpc";
import type { ProjectAgentCore } from "./service";

function recordingCore(calls: string[]): Pick<ProjectAgentCore, "view" | "send" | "decide" | "reset"> {
  return {
    view: (projectId, runId) => {
      calls.push(`view:${projectId}:${runId ?? "-"}`);
      return { session: null, run: null, batches: [], past: [], memoryPath: "m.md" };
    },
    send: (projectId, text) => {
      calls.push(`send:${projectId}:${text}`);
      throw new Error("not needed");
    },
    decide: async (input) => {
      calls.push(`decide:${input.batchId}:${input.decision}:${input.actionIds?.join(",") ?? "-"}`);
      throw new Error("not needed");
    },
    reset: (projectId) => {
      calls.push(`reset:${projectId}`);
      return { session: null, run: null, batches: [], past: [], memoryPath: "m.md" };
    },
  };
}

test("the extension serves the four project agent methods", async () => {
  const calls: string[] = [];
  const rpc = projectAgentRpc(recordingCore(calls));
  expect(new Set<string>(rpc.methods)).toEqual(new Set(PROJECT_AGENT_METHODS));
  await rpc.handle({ method: "getProjectAgent", projectId: "p1", runId: "r0" }, LOCAL_CONTEXT);
  await rpc.handle({ method: "resetProjectAgent", projectId: "p1" }, LOCAL_CONTEXT);
  await expect(
    rpc.handle(
      { method: "decideBatch", projectId: "p1", batchId: "b1", decision: "apply", actionIds: [2] },
      LOCAL_CONTEXT,
    ),
  ).rejects.toThrow("not needed");
  await expect(
    rpc.handle({ method: "sendProjectAgentMessage", projectId: "p1", text: "Bonjour" }, LOCAL_CONTEXT),
  ).rejects.toThrow("not needed");
  expect(calls).toEqual(["view:p1:r0", "reset:p1", "decide:b1:apply:2", "send:p1:Bonjour"]);
});

const REMOTE = { sessionHash: "phone", remote: true };

test("decideBatch is accepted with { remote: true }", async () => {
  const calls: string[] = [];
  const rpc = projectAgentRpc(recordingCore(calls));
  const req: RpcRequest = { method: "decideBatch", projectId: "p1", batchId: "b1", decision: "reject" };
  await expect(rpc.handle(req, REMOTE)).rejects.toThrow("not needed");
  expect(calls).toEqual(["decide:b1:reject:-"]);
});

test("sendProjectAgentMessage too", async () => {
  const calls: string[] = [];
  const rpc = projectAgentRpc(recordingCore(calls));
  const req: RpcRequest = { method: "sendProjectAgentMessage", projectId: "p1", text: "Bonjour" };
  await expect(rpc.handle(req, REMOTE)).rejects.toThrow("not needed");
  await rpc.handle({ method: "getProjectAgent", projectId: "p1" }, REMOTE);
  expect(calls).toEqual(["send:p1:Bonjour", "view:p1:-"]);
});

test("resetProjectAgent is refused with FORBIDDEN when remote", async () => {
  const calls: string[] = [];
  const rpc = projectAgentRpc(recordingCore(calls));
  await expect(rpc.handle({ method: "resetProjectAgent", projectId: "p1" }, REMOTE)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(calls).toEqual([]);
});

test("the inbox and another method are refused before the service", async () => {
  const calls: string[] = [];
  const rpc = projectAgentRpc(recordingCore(calls));
  await expect(
    rpc.handle({ method: "resetProjectAgent", projectId: INBOX_ID }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(rpc.handle({ method: "getAgents" }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INTERNAL",
  });
  expect(calls).toEqual([]);
});
