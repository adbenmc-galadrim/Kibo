import { expect, test } from "bun:test";
import { INBOX_ID, type RpcRequest } from "@kibo/schema";
import { type AgentsPort, handleAgentRequest } from "./agents-rpc";

function recordingPort(calls: string[]): AgentsPort {
  const record =
    (name: string) =>
    (..._args: unknown[]): never => {
      calls.push(name);
      throw new Error(`${name} should not be reached`);
    };
  return {
    assign: record("assign"),
    preview: record("preview"),
    answer: record("answer"),
    cancel: record("cancel"),
    move: record("move"),
    setPriority: record("setPriority"),
    setHost: record("setHost"),
    state: record("state"),
    log: record("log"),
    activeRuns: record("activeRuns"),
    onChange: record("onChange"),
    onRunState: record("onRunState"),
  };
}

test("an inbox ticket is never handed to the orchestrator", () => {
  const calls: string[] = [];
  const port = recordingPort(calls);
  const requests: RpcRequest[] = [
    { method: "previewAssign", projectId: INBOX_ID, ticketId: "1@1", profileId: "dev" },
    { method: "assignAgent", projectId: INBOX_ID, ticketId: "1@1", profileId: "dev", brief: "" },
  ];
  for (const req of requests)
    expect(() => handleAgentRequest(port, req)).toThrow("inbox tickets cannot be assigned to an agent");
  expect(calls).toEqual([]);
});

test("a project ticket still reaches the orchestrator", () => {
  const calls: string[] = [];
  const port = recordingPort(calls);
  expect(() =>
    handleAgentRequest(port, { method: "previewAssign", projectId: "p1", ticketId: "1@1", profileId: "dev" }),
  ).toThrow("preview should not be reached");
  expect(calls).toEqual(["preview"]);
});
