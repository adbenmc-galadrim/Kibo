import { expect, test } from "bun:test";
import { type RpcRequest, TUTORIAL_NEVER, type TutorialState } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { tutorialRpc } from "./rpc";
import type { TutorialService } from "./tutorial-service";

const REMOTE = { sessionHash: "r", remote: true };

function fakeService() {
  const calls: string[] = [];
  const answer = (name: string) => {
    calls.push(name);
    return { ...TUTORIAL_NEVER, status: "active" } satisfies TutorialState;
  };
  const service: TutorialService = {
    get: () => answer("get"),
    start: async () => answer("start"),
    pause: () => answer("pause"),
    skip: () => answer("skip"),
    reset: () => answer("reset"),
    close: () => answer("close"),
    skipStep: (step) => answer(`skipStep:${step}`),
    markSeen: (view) => answer(`markSeen:${view}`),
    simulateReview: (projectId) => answer(`simulateReview:${projectId}`),
    refresh: () => {},
  };
  return { service, calls };
}

const REQUESTS: RpcRequest[] = [
  { method: "getTutorial" },
  { method: "startTutorial" },
  { method: "pauseTutorial" },
  { method: "skipTutorial" },
  { method: "resetTutorial" },
  { method: "skipTutorialStep", step: "question" },
  { method: "markTutorialSeen", view: "copy" },
  { method: "closeTutorial" },
  { method: "simulateTutorialReview", projectId: "demo" },
];

test("the nine tutorial methods reach the service", async () => {
  const { service, calls } = fakeService();
  const rpc = tutorialRpc(service);
  expect([...rpc.methods].sort()).toEqual(REQUESTS.map((r) => r.method).sort());
  for (const req of REQUESTS)
    expect(await rpc.handle(req, LOCAL_CONTEXT)).toMatchObject({ status: "active" });
  expect(calls).toEqual([
    "get",
    "start",
    "pause",
    "skip",
    "reset",
    "skipStep:question",
    "markSeen:copy",
    "close",
    "simulateReview:demo",
  ]);
});

test("every tutorial method is refused to a remote session", async () => {
  const { service, calls } = fakeService();
  const rpc = tutorialRpc(service);
  for (const req of REQUESTS) await expect(rpc.handle(req, REMOTE)).rejects.toThrow("FORBIDDEN");
  expect(calls).toEqual([]);
});
