import { type RpcHandler, type RpcOutcome, requireLocal } from "../rpc-extensions";
import type { MarketService } from "./market-service";

export function createMarketRpc(market: MarketService): RpcHandler {
  const done = (result: unknown): RpcOutcome => ({ handled: true, result });
  return async (req, ctx) => {
    switch (req.method) {
      case "listMarketSources":
        return done(market.listSources());
      case "probeMarketSource":
        requireLocal(ctx);
        return done(await market.probe(req.url));
      case "addMarketSource":
        requireLocal(ctx);
        return done(await market.addSource({ url: req.url, publicKey: req.publicKey }));
      case "removeMarketSource":
        requireLocal(ctx);
        await market.removeSource(req.id);
        return done(null);
      case "refreshMarket":
        await market.refresh();
        return done(null);
      case "searchMarket":
        return done(market.search({ query: req.query, sourceId: req.sourceId, kind: req.kind }));
      case "getMarketPackage":
        return done(await market.getPackage({ sourceId: req.sourceId, id: req.id, version: req.version }));
      case "unpinPublisher":
        requireLocal(ctx);
        market.unpinPublisher({ sourceId: req.sourceId, componentId: req.componentId });
        return done(null);
      case "findMarketSource":
        return done(market.findSourceFor({ id: req.id, version: req.version, hash: req.hash }));
      default:
        return { handled: false };
    }
  };
}
