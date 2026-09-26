import { createEventLog as createRefusalLog, ensureEventsTable } from "../components/events";
import { proxyFetch } from "../components/net-proxy";
import { createQuotas } from "../components/quotas";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import { BINDING_FETCH_PER_MINUTE, createBindingCalls } from "./binding-calls";
import { createAdapterHosts, loadBuiltinAdapter } from "./builtin-adapter";
import { syncModule } from "./module";
import { createWorkerRunner } from "./worker-runner";

export function githubIssuesModule(kit: IntegrationKit): IntegrationModule {
  const { host } = kit;
  ensureEventsTable(host.db);
  const refusals = createRefusalLog(host.db);
  const quotas = createQuotas({ fetchPerMinute: BINDING_FETCH_PER_MINUTE });
  const adapters = createAdapterHosts({
    load: (id) => loadBuiltinAdapter(id),
    calls: (manifest) =>
      createBindingCalls({
        bindings: (projectId) => host.snapshot(projectId).bindings,
        manifest,
        quotas,
        refusals,
        fetch: (m, url, init) => proxyFetch(m.net, url, init, { hooks: kit.hooks, secrets: m.secrets }),
      }),
  });
  const sync = syncModule(kit, createWorkerRunner(adapters.invoke), () => kit.github.account.mode() !== null);
  return {
    ...sync,
    stop() {
      sync.stop?.();
      adapters.stop();
      refusals.flush();
    },
  };
}
