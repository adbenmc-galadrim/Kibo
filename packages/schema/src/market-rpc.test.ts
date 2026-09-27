import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";

test("marketplace RPCs parse", () => {
  const requests = [
    { method: "listMarketSources" },
    { method: "probeMarketSource", url: "https://market.kibo.test" },
    { method: "addMarketSource", url: "https://market.kibo.test", publicKey: "AAAA" },
    { method: "removeMarketSource", id: "team" },
    { method: "refreshMarket" },
    { method: "searchMarket", query: "burn" },
    { method: "searchMarket", query: "", sourceId: "team", kind: "widget" },
    { method: "getMarketPackage", sourceId: "team", id: "burndown", version: "0.3.0" },
    { method: "unpinPublisher", sourceId: "team", componentId: "burndown" },
    { method: "findMarketSource", id: "burndown", version: "0.3.0", hash: null },
    { method: "installFromMarket", sourceId: "team", id: "burndown", version: "0.3.0" },
    { method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "team" },
    { method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "team", publisherName: "Léa" },
    { method: "exportKpkg", id: "burndown", version: "0.3.0" },
    { method: "listMarketStatus" },
    { method: "getMarketPublisher" },
  ];
  for (const r of requests) expect(RpcRequest.safeParse(r).success).toBe(true);
});

test("invalid marketplace RPCs are refused", () => {
  expect(
    RpcRequest.safeParse({ method: "getMarketPackage", sourceId: "team", id: "burndown", version: "1" })
      .success,
  ).toBe(false);
  expect(
    RpcRequest.safeParse({ method: "findMarketSource", id: "burndown", version: "0.3.0", hash: "x" }).success,
  ).toBe(false);
  expect(RpcRequest.safeParse({ method: "probeMarketSource", url: "" }).success).toBe(false);
  expect(
    RpcRequest.safeParse({
      method: "publishToMarket",
      id: "burndown",
      version: "0.3.0",
      sourceId: "team",
      publisherName: "",
    }).success,
  ).toBe(false);
});
