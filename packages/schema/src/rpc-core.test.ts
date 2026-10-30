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

test("the marketplace RPCs no longer parse", () => {
  const retired = [
    { method: "listMarketSources" },
    { method: "searchMarket", query: "burn" },
    { method: "installFromMarket", sourceId: "team", id: "burndown", version: "0.3.0" },
    { method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "team" },
    { method: "exportKpkg", id: "burndown", version: "0.3.0" },
    { method: "getMarketPublisher" },
  ];
  for (const request of retired) expect(RpcRequest.safeParse(request).success).toBe(false);
});
