import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";

test("delivering answers is no longer an rpc", () => {
  expect(RpcRequest.safeParse({ method: "deliverAnswers", projectId: "p1", ticketId: "t1" }).success).toBe(
    false,
  );
});

test("answering a run stays an rpc", () => {
  expect(RpcRequest.parse({ method: "answerRun", runId: "r1", text: "oui" })).toEqual({
    method: "answerRun",
    runId: "r1",
    text: "oui",
  });
});
