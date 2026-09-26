import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { CiStore } from "./ci-store";
import { purgeCiLogs, readCiLog } from "./logs";
import type { CiPoller } from "./poller";

const PURGE_EVERY_MS = 24 * 3_600_000;

export function ciModule(kit: IntegrationKit, poller: CiPoller, store: CiStore): IntegrationModule {
  const deps = { host: kit.host, api: kit.github.api, store, redact: kit.redactor.redact };
  purgeCiLogs(deps, kit.host.now());
  const stopPoller = poller.start();
  const purge = setInterval(() => {
    try {
      purgeCiLogs(deps, kit.host.now());
    } catch (e) {
      kit.events.log("github-actions", "error", `log purge failed: ${String(e)}`);
    }
  }, PURGE_EVERY_MS);
  return {
    handlers: {
      listCiRuns: (req) => poller.runs(req.projectId, req.ticketId),
      getCiLog: (req) => readCiLog(deps, req.projectId, req.runId, req.jobId),
    },
    stop() {
      stopPoller();
      clearInterval(purge);
    },
  };
}
