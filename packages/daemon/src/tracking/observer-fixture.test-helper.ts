import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchRefOf, type ProjectCommand, type StatusId, type Ticket } from "@kibo/schema";
import type { CommandEvent } from "../docs";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";

export type ObserverFixture = {
  dir: string;
  service: Service;
  projectId: string;
  events: CommandEvent[];
  ticket(key: string): Ticket;
  setStatus(key: string, statusId: StatusId, reason?: string): void;
  declare(key: string, branch: string): void;
  branchOf(key: string): string | null;
  close(): void;
};

export function createObserverFixture(ticketCount: number, folder?: string): ObserverFixture {
  const dir = mkdtempSync(join(tmpdir(), "kibo-observer-"));
  const store: Store = openStore(join(dir, "home"));
  const service = createService(store, { user: "adam" });
  const project = call(service, {
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder: folder ?? dir,
    color: "#F97316",
  });
  const command = (cmd: ProjectCommand) =>
    call(service, { method: "command", projectId: project.id, command: cmd });
  for (let i = 1; i <= ticketCount; i++) {
    const created = command({ method: "createTicket", title: `Étape ${i}` }) as Ticket;
    command({ method: "setStatus", ticketId: created.id, statusId: "todo" });
  }
  const events: CommandEvent[] = [];
  service.commands.onCommand((e) => void events.push(e));
  const ticket = (key: string): Ticket => {
    const found = call(service, { method: "getProject", projectId: project.id }).tickets.find(
      (t) => t.key === key,
    );
    if (!found) throw new Error(`no ticket ${key}`);
    return found;
  };
  return {
    dir,
    service,
    projectId: project.id,
    events,
    ticket,
    setStatus: (key, statusId, reason) =>
      command({ method: "setStatus", ticketId: ticket(key).id, statusId, ...(reason ? { reason } : {}) }),
    declare: (key, branch) =>
      command({
        method: "upsertExternalRef",
        ticketId: ticket(key).id,
        ref: { kind: "git_branch", branch, base: null },
      }),
    branchOf: (key) => branchRefOf(ticket(key).externalRefs)?.branch ?? null,
    close() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
