import { expect, test } from "bun:test";
import { ComponentCall } from "./call";
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

test("the third-party component RPCs no longer parse", () => {
  const retired = [
    { method: "listComponents" },
    { method: "approveComponent", id: "burndown", version: "0.1.0", hash: "a".repeat(64), trust: "trusted" },
    { method: "revokeComponent", id: "burndown", version: "0.1.0" },
    { method: "rehashComponent", id: "burndown", version: "0.1.0" },
    { method: "previewPublish", id: "burndown" },
    { method: "publishComponent", id: "burndown", strategy: "new-version" },
    { method: "updateInstance", projectId: "p1", instanceId: "i1", to: "0.2.0" },
    { method: "uninstallComponent", id: "burndown", version: "0.1.0" },
    { method: "listDrafts" },
    { method: "getRuntimeInfo" },
  ];
  for (const request of retired) expect(RpcRequest.safeParse(request).success).toBe(false);
});

test("components no longer reach the notes", () => {
  const calls = [
    { kind: "notes.read", path: "a.md" },
    { kind: "notes.info" },
    { kind: "list", entity: "note" },
  ];
  for (const call of calls) expect(ComponentCall.safeParse(call).success).toBe(false);
});
