import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  listTickets,
  migrateForSharing,
  setStatus,
} from "@kibo/core";
import type { Domain, ProjectMeta, Ticket } from "@kibo/schema";
import { call, createService } from "../service";
import { openStore } from "../store";
import { applyRules } from "./data-port";

const doc = () =>
  createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316", worktree: null });

test("a finished run leaves its ticket in its status, and a started one moves it on", () => {
  const d = doc();
  const t = createTicket(d, { title: "A", statusId: "in_progress" });
  const todo = createTicket(d, { title: "B", statusId: "todo" });
  expect(applyRules(d, { kind: "run_done", ticketId: t.id })).toEqual([]);
  expect(applyRules(d, { kind: "run_started", ticketId: todo.id })).toEqual([
    { method: "setStatus", ticketId: todo.id, statusId: "in_progress" },
  ]);
  expect(applyRules(d, { kind: "run_done", ticketId: todo.id })).toEqual([]);
  expect(listTickets(d).map((x) => x.statusId)).toEqual(["in_progress", "in_progress"]);
});

test("the last child done closes its parent", () => {
  const d = doc();
  const parent = createTicket(d, { title: "P", statusId: "in_progress" });
  const a = createTicket(d, { title: "A", parentId: parent.id });
  const b = createTicket(d, { title: "B", parentId: parent.id });
  setStatus(d, a.id, "done");
  expect(applyRules(d, { kind: "status_changed", ticketId: a.id })).toEqual([]);
  setStatus(d, b.id, "done");
  applyRules(d, { kind: "status_changed", ticketId: b.id });
  expect(listTickets(d).find((x) => x.id === parent.id)?.statusId).toBe("done");
});

test("a chain of parents closes in the order the rules return", () => {
  const d = doc();
  const root = createTicket(d, { title: "R", statusId: "in_progress" });
  const mid = createTicket(d, { title: "M", parentId: root.id, statusId: "in_progress" });
  const leaf = createTicket(d, { title: "L", parentId: mid.id });
  setStatus(d, leaf.id, "done");
  expect(applyRules(d, { kind: "status_changed", ticketId: leaf.id })).toEqual([
    { method: "setStatus", ticketId: mid.id, statusId: "done" },
    { method: "setStatus", ticketId: root.id, statusId: "done" },
  ]);
  expect(listTickets(d).map((x) => x.statusId)).toEqual(["done", "done", "done"]);
});

test("a started run puts its todo ticket in progress", () => {
  const d = doc();
  const t = createTicket(d, { title: "A", statusId: "todo" });
  expect(applyRules(d, { kind: "run_started", ticketId: t.id })).toEqual([
    { method: "setStatus", ticketId: t.id, statusId: "in_progress" },
  ]);
});

test("a shared project takes its domains and domain guidelines from the project, not the workspace", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-port-"));
  const store = openStore(home);
  const s = createService(store, { user: "adam" });
  const meta: ProjectMeta = call(s, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const core = s.handle({
    method: "config",
    command: { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } },
  }) as Domain;
  const owner = { scope: "domain", domainId: core.id } as const;
  s.handle({
    method: "config",
    command: { method: "addGuideline", owner, path: "core.md", content: "Poste" },
  });
  s.handle({
    method: "config",
    command: { method: "addGuideline", owner: { scope: "workspace" }, path: "all.md", content: "Local" },
  });
  const ticket = s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "A" },
  }) as Ticket;
  s.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "updateTicket", ticketId: ticket.id, domainId: core.id },
  });
  const doc = s.docs.project(meta.id);
  const guidelines = [{ path: "core.md", content: "Partagé" }];
  migrateForSharing(doc, { localUser: "adam", userId: "u-adam", domains: [{ domain: core, guidelines }] });
  enableServerAllocation(doc);
  s.handle({
    method: "config",
    command: { method: "updateDomain", domainId: core.id, patch: { name: "Renommé localement" } },
  });
  expect(s.agentData.ticketContext(meta.id, ticket.id).domain?.name).toBe("Core");
  const contents = s.agentData.guidelines(meta.id).map((g) => `${g.owner.scope}:${g.content}`);
  expect(contents.sort()).toEqual(["domain:Partagé", "workspace:Local"]);
  store.close();
  rmSync(home, { recursive: true, force: true });
});
