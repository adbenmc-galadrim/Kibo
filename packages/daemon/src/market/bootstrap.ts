import type { Database } from "bun:sqlite";
import { MARKET_REFRESH_MS } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { ComponentsService } from "../components/service";
import type { Docs } from "../docs";
import type { RpcHandler } from "../rpc-extensions";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { startMarketRefresh } from "./refresh-schedule";
import { createRegistryPort } from "./registry-port";
import { createMarketRpc } from "./rpc";

const log = (m: string, e: unknown) => console.error(`[kibo-daemon] ${m}`, e);

export function startMarket(deps: {
  db: Database;
  docs: Docs;
  components: ComponentsService;
  notify(notice: Notice): void;
  allowLoopbackHttp: boolean;
  now?: () => number;
}): { market: MarketService; handler: RpcHandler; stop(): void } {
  const market = new MarketService({
    db: openMarketDb(deps.db),
    get: createHttpGet({ allowLoopbackHttp: deps.allowLoopbackHttp }),
    registry: createRegistryPort({ docs: deps.docs, components: deps.components }),
    now: deps.now ?? Date.now,
    notify: deps.notify,
    log,
    emit: () => deps.docs.emit({ type: "market.changed" }),
  });
  const stop = startMarketRefresh(market, { intervalMs: MARKET_REFRESH_MS, log });
  return { market, handler: createMarketRpc(market), stop };
}
