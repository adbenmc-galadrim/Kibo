import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectCommand, ProjectEvent, ProjectMeta, Ticket } from "@kibo/schema";
import { type CommandMeta, USER_COMMAND } from "../docs";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type ProjectEvents, startProjectEvents } from "./bootstrap";

export type EventsHarness = {
  service: Service;
  project: ProjectMeta;
  events: ProjectEvents;
  clock: { now: number };
  changes: (string | null)[];
  run(command: ProjectCommand, meta?: CommandMeta): unknown;
  ticket(title: string, parentId?: string | null): string;
  journal(): ProjectEvent[];
  close(): void;
};

export function eventsHarness(): EventsHarness {
  const dir = mkdtempSync(join(tmpdir(), "kibo-events-"));
  const store: Store = openStore(join(dir, "home"));
  const service = createService(store, { user: "adam" });
  const project = call(service, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  });
  const clock = { now: 1_000 };
  const events = startProjectEvents({ store, service, now: () => clock.now });
  const changes: (string | null)[] = [];
  service.onChange((m) => {
    if ("projectId" in m) changes.push(m.projectId);
  });
  const run = (command: ProjectCommand, meta: CommandMeta = USER_COMMAND) =>
    service.docs.run(project.id, command, meta);
  return {
    service,
    project,
    events,
    clock,
    changes,
    run,
    ticket: (title, parentId = null) => (run({ method: "createTicket", title, parentId }) as Ticket).id,
    journal: () => events.store.list({ projectId: project.id, limit: 200 }).items.reverse(),
    close() {
      events.stop();
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
