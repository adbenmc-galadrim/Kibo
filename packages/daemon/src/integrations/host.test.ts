import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChangeMessage, ProjectMeta, Ticket } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { CommandEvent } from "../docs";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { createIntegrationHost } from "./host";
import type { IntegrationHost } from "./types";

let home: string;
let store: Store;
let service: Service;
let host: IntegrationHost;
let project: ProjectMeta;
let notices: Notice[];

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-host-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  notices = [];
  host = createIntegrationHost({ user: "adam", home, store, service, notify: (n) => notices.push(n) });
  project = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#71717A",
  });
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const createTicket = (title: string) =>
  host.command(project.id, { method: "createTicket", title }, { origin: "user", instanceId: null });
const persistedTitles = () =>
  call(createService(store, { user: "adam" }), { method: "getProject", projectId: project.id }).tickets.map(
    (t) => t.title,
  );

test("commands carry their origin and observers run inside the persistence transaction", () => {
  const seen: CommandEvent[] = [];
  host.onCommand((e) => {
    seen.push(e);
    expect(store.db.inTransaction).toBe(true);
  });
  host.command(project.id, { method: "createTicket", title: "A" }, { origin: "sync", instanceId: null });
  expect(seen[0]?.meta).toEqual({ origin: "sync", instanceId: null });
  expect(seen[0]?.command.method).toBe("createTicket");
});

test("a failing observer rolls back persistence and restores the in-memory doc", () => {
  createTicket("Kept");
  const off = host.onCommand(() => {
    throw new Error("observer boom");
  });
  expect(() => createTicket("Lost")).toThrow("observer boom");
  off();
  expect(host.snapshot(project.id).tickets.map((t) => t.title)).toEqual(["Kept"]);
  expect(persistedTitles()).toEqual(["Kept"]);
});

test("interceptors rewrite a command before observers see it", () => {
  const seen: string[] = [];
  host.intercept((_p, cmd) => (cmd.method === "createTicket" ? { ...cmd, title: `${cmd.title}!` } : cmd));
  host.onCommand((e) => seen.push(e.command.method === "createTicket" ? e.command.title : ""));
  createTicket("A");
  expect(seen).toEqual(["A!"]);
  expect(host.snapshot(project.id).tickets[0]?.title).toBe("A!");
});

test("the command rpc checks its instance and passes it to observers", () => {
  const seen: CommandEvent[] = [];
  host.onCommand((e) => seen.push(e));
  expect(() =>
    call(service, {
      method: "command",
      projectId: project.id,
      instanceId: "nope",
      command: { method: "createTicket", title: "X" },
    }),
  ).toThrow("NOT_FOUND");
  call(service, {
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Y" },
  });
  expect(seen.map((e) => e.meta)).toEqual([{ origin: "user", instanceId: null }]);
});

test("agents, rules and derived statuses reach the same observers", () => {
  const parent = createTicket("Parent");
  const child = host.command(
    project.id,
    { method: "createTicket", title: "Enfant", parentId: parent.id },
    { origin: "user", instanceId: null },
  );
  const seen: string[] = [];
  host.onCommand((e) =>
    seen.push(`${e.command.method}:${"ticketId" in e.command ? e.command.ticketId : ""}`),
  );
  service.agentData.assignTicket(project.id, child.id, "dev");
  service.triggerRules(project.id, { kind: "pr_merged", ticketId: child.id });
  expect(seen).toEqual([`updateTicket:${child.id}`, `setStatus:${child.id}`, `setStatus:${parent.id}`]);
  const tickets: Ticket[] = host.snapshot(project.id).tickets;
  expect(tickets.map((t) => t.statusId)).toEqual(["done", "done"]);
});

test("a failing derived command restores the doc and skips persistence", () => {
  const parent = createTicket("Parent");
  const child = host.command(
    project.id,
    { method: "createTicket", title: "Enfant", parentId: parent.id },
    { origin: "user", instanceId: null },
  );
  host.onCommand((e) => {
    if (e.command.method === "setStatus" && e.command.ticketId === parent.id) throw new Error("derived boom");
  });
  expect(() =>
    host.command(
      project.id,
      { method: "setStatus", ticketId: child.id, statusId: "done" },
      { origin: "user", instanceId: null },
    ),
  ).toThrow("derived boom");
  expect(host.snapshot(project.id).tickets.map((t) => t.statusId)).toEqual(["todo", "todo"]);
  const persisted = call(createService(store, { user: "adam" }), {
    method: "getProject",
    projectId: project.id,
  });
  expect(persisted.tickets.map((t) => t.statusId)).toEqual(["todo", "todo"]);
});

test("a failing host transaction restores the docs it touched", () => {
  createTicket("Kept");
  const changes: ChangeMessage[] = [];
  service.onChange((m) => changes.push(m));
  expect(() =>
    host.transaction(() => {
      createTicket("Lost");
      throw new Error("sync write failed");
    }),
  ).toThrow("sync write failed");
  expect(host.snapshot(project.id).tickets.map((t) => t.title)).toEqual(["Kept"]);
  expect(persistedTitles()).toEqual(["Kept"]);
  expect(changes.at(-1)).toEqual({ projectId: project.id });
});

test("a host transaction commits every command it runs", () => {
  const out = host.transaction(() => {
    createTicket("A");
    createTicket("B");
    return "ok";
  });
  expect(out).toBe("ok");
  expect(persistedTitles()).toEqual(["A", "B"]);
});

test("broadcasts and notices go through the change channel", () => {
  const messages: ChangeMessage[] = [];
  service.onChange((m) => messages.push(m));
  host.broadcast({ type: "integrations" });
  host.notify({ title: "CI cassée sur KIB-1", body: "ci a échoué sur la PR #12." });
  expect(messages).toEqual([
    { type: "integrations" },
    { type: "notice", title: "CI cassée sur KIB-1", body: "ci a échoué sur la PR #12." },
  ]);
  expect(notices).toEqual([{ title: "CI cassée sur KIB-1", body: "ci a échoué sur la PR #12." }]);
});

test("a project without folder has no git remote", async () => {
  expect(await host.gitRemoteUrl(project.id)).toBeNull();
});
