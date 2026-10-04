import {
  type IntegrationEvent as Event,
  IntegrationEvent,
  type RpcRequest,
  type RpcResult,
} from "@kibo/schema";
import { parseIntegrationFlags, startIntegrations } from "../../integrations/bootstrap";
import { createIntegrationHost } from "../../integrations/host";
import { createRedactor } from "../../integrations/redact";
import { createService } from "../../service";
import { openStore } from "../../store";
import type { FakeGithub } from "../../testing/fake-github";

export type DaemonSide = {
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  events: Event[];
  close(): void;
};

export function openDaemonSide(home: string, gh: FakeGithub, now: () => number): DaemonSide {
  const store = openStore(home);
  const service = createService(store, { user: "adam" });
  const host = createIntegrationHost({
    user: "adam",
    home,
    store,
    service,
    notify: () => {},
    now,
    sandboxOrigin: () => null,
  });
  const integrations = startIntegrations(
    host,
    parseIntegrationFlags({ "test-origins": `api.github.com=${gh.url}`, "memory-secrets": true }),
    createRedactor(),
  );
  const detach = service.attachIntegrations(integrations);
  const events: Event[] = [];
  service.onChange((m) => {
    const e = IntegrationEvent.safeParse(m);
    if (e.success) events.push(e.data);
  });
  return {
    rpc: async (req) => (await service.handle(req)) as RpcResult[(typeof req)["method"]],
    events,
    close() {
      detach();
      integrations.stop();
      store.close();
    },
  };
}
