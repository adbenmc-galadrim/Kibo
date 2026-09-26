import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { osSandbox, type Toolchain, validateComponent } from "@kibo/devkit";
import { MARKET_REFRESH_MS, type ValidationReport } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { ComponentsService } from "../components/service";
import type { Docs } from "../docs";
import type { RpcHandler } from "../rpc-extensions";
import { createHttpGet } from "./http-get";
import type { InstallDeps } from "./install";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { startMarketRefresh } from "./refresh-schedule";
import { createRegistryPort } from "./registry-port";
import { createMarketRpc } from "./rpc";

const log = (m: string, e: unknown) => console.error(`[kibo-daemon] ${m}`, e);

type Validate = (dir: string, signal: AbortSignal) => Promise<ValidationReport>;

export function startMarket(deps: {
  home: string;
  toolchain: Toolchain;
  validate?: Validate;
  db: Database;
  docs: Docs;
  components: ComponentsService;
  notify(notice: Notice): void;
  allowLoopbackHttp: boolean;
  now?: () => number;
}): { market: MarketService; handler: RpcHandler; stop(): void } {
  const shutdown = new AbortController();
  const registry = createRegistryPort({ docs: deps.docs, components: deps.components });
  const market = new MarketService({
    db: openMarketDb(deps.db),
    get: createHttpGet({ allowLoopbackHttp: deps.allowLoopbackHttp, log }),
    registry,
    now: deps.now ?? Date.now,
    notify: deps.notify,
    log,
    emit: () => deps.docs.emit({ type: "market.changed" }),
  });
  const validate: Validate =
    deps.validate ??
    ((dir, signal) => validateComponent(dir, { toolchain: deps.toolchain, conformanceOnly: true, signal }));
  const install: InstallDeps = {
    market,
    store: deps.components.store,
    registry,
    validate: (dir) => validate(dir, shutdown.signal),
    sandbox: osSandbox(),
    lock: deps.components.publishLock,
    tmpRoot: join(deps.home, "tmp", "market"),
  };
  const stopRefresh = startMarketRefresh(market, { intervalMs: MARKET_REFRESH_MS, log });
  const stop = () => {
    shutdown.abort();
    stopRefresh();
  };
  return { market, handler: createMarketRpc(market, install), stop };
}
