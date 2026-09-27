import type { MarketService } from "./market-service";

export function startMarketRefresh(
  service: MarketService,
  opts: { intervalMs: number; log(message: string, error: unknown): void },
): () => void {
  const run = () => {
    service.refresh().catch((e: unknown) => opts.log("market: scheduled refresh failed", e));
  };
  service.load().then(run, (e: unknown) => opts.log("market: cache load failed", e));
  const timer = setInterval(run, opts.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
