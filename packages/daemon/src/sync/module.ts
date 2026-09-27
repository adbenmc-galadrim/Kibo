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
  return {
    handlers: {
      async createBinding(req) {
        if (!connected()) throw new KiboError("NOT_CONNECTED", "connect github first");
        const repo = req.config.repo.toLowerCase();
        if (host.snapshot(req.projectId).bindings.some((b) => b.config.repo.toLowerCase() === repo))
          throw new KiboError("CONFLICT", `${req.config.repo} is already bound in this project`);
        const binding = {
          id: crypto.randomUUID(),
          adapter: "github-issues" as const,
          config: req.config,
          createdBy: host.identity(req.projectId),
          runner: host.identity(req.projectId),
        };
        host.command(req.projectId, { method: "addBinding", binding }, { origin: "user", instanceId: null });
        engine.cycle(req.projectId, binding.id).catch(() => undefined);
        return binding;
      },
      async deleteBinding(req) {
        await engine.deleteBinding(req.projectId, req.bindingId);
        return null;
      },
      syncBinding: (req) => engine.cycle(req.projectId, req.bindingId),
      getSyncState: async (req) => ({ ...engine.state(req.projectId), connected: connected() }),
      async resolveOutbox(req) {
        const row = store.row(req.outboxId);
        engine.resolveOutbox(req.projectId, req.outboxId, req.action);
        if (row) scheduler.kick(req.projectId, row.bindingId);
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
