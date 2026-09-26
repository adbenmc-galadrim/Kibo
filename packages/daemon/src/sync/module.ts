import { KiboError } from "@kibo/schema";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { AdapterRunner } from "../integrations/types";
import { createSyncEngine, type PauseGate } from "./engine";
import { outboxObserver, syncInterceptor } from "./outbox";
import { startSyncScheduler } from "./scheduler";
import { createSyncStore } from "./sync-store";

export function syncModule(
  kit: IntegrationKit & { net: { gate: PauseGate } },
  runner: AdapterRunner,
  connected: () => boolean,
): IntegrationModule {
  const { host, events } = kit;
  const store = createSyncStore(host.db);
  const engine = createSyncEngine({
    host,
    store,
    runner,
    gate: kit.net.gate,
    events,
    redact: kit.redactor.redact,
  });
  const scheduler = startSyncScheduler(engine, events);
  const offIntercept = host.intercept(syncInterceptor(host));
  const offObserve = host.onCommand(outboxObserver(store, host, (p, b) => scheduler.kick(p, b)));
  const log = (e: unknown) =>
    events.log("github-issues", "error", e instanceof Error ? e.message : String(e));
  return {
    handlers: {
      async createBinding(req) {
        if (!connected()) throw new KiboError("NOT_CONNECTED", "connect github first");
        const binding = {
          id: crypto.randomUUID(),
          adapter: "github-issues" as const,
          config: req.config,
          createdBy: host.user,
          runner: host.user,
        };
        host.command(req.projectId, { method: "addBinding", binding }, { origin: "user", instanceId: null });
        engine.cycle(req.projectId, binding.id).catch(log);
        return binding;
      },
      async deleteBinding(req) {
        engine.deleteBinding(req.projectId, req.bindingId);
        return null;
      },
      syncBinding: (req) => engine.cycle(req.projectId, req.bindingId),
      getSyncState: async (req) => engine.state(req.projectId),
      async resolveOutbox(req) {
        const row = store.row(req.outboxId);
        engine.resolveOutbox(req.projectId, req.outboxId, req.action);
        if (row && req.action === "retry") scheduler.kick(req.projectId, row.bindingId);
        return null;
      },
    },
    stop() {
      scheduler.stop();
      offIntercept();
      offObserve();
    },
  };
}
