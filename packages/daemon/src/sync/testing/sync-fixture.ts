import type { Binding } from "@kibo/schema";
import { createEventLog } from "../../integrations/events";
import { createRedactor } from "../../integrations/redact";
import { createFakeHost, type FakeHost } from "../../integrations/testing/fake-host";
import { createSyncEngine, type SyncEngine } from "../engine";
import { outboxObserver, syncInterceptor } from "../outbox";
import { createSyncStore, type SyncStore } from "../sync-store";
import { createMemoryRunner, type MemoryRunner } from "./memory-runner";

export const TEST_BINDING: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
export const USER = { origin: "user" as const, instanceId: null };

export type SyncFixture = {
  host: FakeHost;
  remote: MemoryRunner;
  store: SyncStore;
  engine: SyncEngine;
  gate: { until: number | null; blockedUntil(): number | null };
  instanceId(): string;
};

function addSyncedKanban(host: FakeHost): void {
  host.command(host.projectId, { method: "addBinding", binding: TEST_BINDING }, USER);
  host.command(host.projectId, { method: "addPage", title: "Kanban", kind: "view" }, USER);
  const page = host.snapshot(host.projectId).pages[0];
  if (!page) throw new Error("page missing");
  host.command(
    host.projectId,
    {
      method: "addInstance",
      pageId: page.id,
      component: "kanban@1.0.0",
      config: { source: { bindingId: TEST_BINDING.id } },
    },
    USER,
  );
}

export function createSyncFixture(): SyncFixture {
  const host = createFakeHost();
  const remote = createMemoryRunner(host.clock);
  const store = createSyncStore(host.db);
  const redactor = createRedactor();
  const gate: SyncFixture["gate"] = {
    until: null,
    blockedUntil: () => (gate.until !== null && gate.until > host.now() ? gate.until : null),
  };
  const events = createEventLog(host.db, redactor, host.now);
  const engine = createSyncEngine({ host, store, runner: remote, gate, events, redact: redactor.redact });
  host.intercept(syncInterceptor(host));
  host.onCommand(outboxObserver(store, host, () => undefined));
  addSyncedKanban(host);
  return {
    host,
    remote,
    store,
    engine,
    gate,
    instanceId: () => host.snapshot(host.projectId).instances[0]?.id ?? "",
  };
}
