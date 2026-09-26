import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Binding, KiboError, type TicketView } from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createSyncEngine, type SyncEngine } from "./engine";
import { outboxObserver, syncInterceptor } from "./outbox";
import { createSyncStore, type SyncStore } from "./sync-store";
import { createMemoryRunner, type MemoryRunner } from "./testing/memory-runner";

let host: FakeHost;
let remote: MemoryRunner;
let store: SyncStore;
let engine: SyncEngine;
const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const USER = { origin: "user" as const, instanceId: null };

beforeEach(() => {
  host = createFakeHost();
  remote = createMemoryRunner(host.clock);
  store = createSyncStore(host.db);
  const gate = { blockedUntil: () => null };
  engine = createSyncEngine({
    host,
    store,
    runner: remote,
    gate,
    events: createEventLog(host.db, createRedactor(), host.now),
    redact: createRedactor().redact,
  });
  host.intercept(syncInterceptor(host));
  host.onCommand(outboxObserver(store, host, () => undefined));
  host.command(host.projectId, { method: "addBinding", binding }, USER);
  host.command(host.projectId, { method: "addPage", title: "Kanban", kind: "view" }, USER);
  const page = host.snapshot(host.projectId).pages[0];
  if (!page) throw new Error("page missing");
  host.command(
    host.projectId,
    {
      method: "addInstance",
      pageId: page.id,
      component: "kanban@1.0.0",
      config: { source: { bindingId: "b1" } },
    },
    USER,
  );
});
afterEach(() => host.close());

const tickets = (): TicketView[] => host.snapshot(host.projectId).tickets;
const instanceId = () => host.snapshot(host.projectId).instances[0]?.id ?? "";
const cycle = () => engine.cycle(host.projectId, "b1");

describe("pull", () => {
  test("imports open issues with their ref, skips closed ones, then is a fixed point", async () => {
    remote.add({ title: "Ouverte" });
    remote.add({ title: "Fermée", closed: true });
    const report = await cycle();
    expect(report).toMatchObject({ created: 1, pushed: 0 });
    expect(tickets().map((t) => [t.title, t.externalRefs[0]?.kind])).toEqual([["Ouverte", "github_issue"]]);
    const before = remote.pushes.length;
    expect(await cycle()).toMatchObject({ created: 0, updated: 0, pushed: 0 });
    expect(remote.pushes.length).toBe(before);
  });

  test("a remote rename is applied; a remote close marks the ticket done", async () => {
    const issue = remote.add({ title: "A" });
    await cycle();
    remote.edit(issue.number, { title: "B", closed: true });
    await cycle();
    expect(tickets()[0]).toMatchObject({ title: "B", statusId: "done" });
  });

  test("an issue reopened as blocked reopens the ticket as todo and stays open (N37)", async () => {
    remote.add({ title: "A" });
    await cycle();
    host.command(
      host.projectId,
      { method: "setStatus", ticketId: tickets()[0]?.id ?? "", statusId: "done" },
      USER,
    );
    await cycle();
    expect(remote.issues.get(1)?.fields.closed).toBe(true);
    remote.edit(1, { closed: false, statusId: "blocked" });
    await cycle();
    expect(tickets()[0]?.statusId).toBe("todo");
    const before = remote.pushes.length;
    await cycle();
    expect(remote.pushes.length).toBe(before);
    expect(remote.issues.get(1)?.fields).toMatchObject({ closed: false, statusId: "blocked" });
  });
});

describe("push", () => {
  test("a ticket created from a synced instance shows at once, then becomes an issue", async () => {
    host.command(
      host.projectId,
      { method: "createTicket", title: "Depuis Kibo" },
      { origin: "user", instanceId: instanceId() },
    );
    const created = tickets()[0];
    expect(created?.externalRefs[0]).toMatchObject({ kind: "github_issue", bindingId: "b1", number: null });
    expect(engine.state(host.projectId).pending).toEqual([created?.id ?? ""]);
    await cycle();
    expect(remote.pushes[0]).toMatchObject({ kind: "create", fields: { title: "Depuis Kibo" }, since: null });
    expect(tickets()[0]?.externalRefs[0]).toMatchObject({
      number: 1,
      url: "https://github.com/adam/kibo/issues/1",
    });
    expect(engine.state(host.projectId).pending).toEqual([]);
  });

  test("sub-tickets and unlinked tickets are never pushed", async () => {
    host.command(host.projectId, { method: "createTicket", title: "Local" }, USER);
    const parent = tickets()[0];
    host.command(
      host.projectId,
      { method: "createTicket", title: "Enfant", parentId: parent?.id ?? null },
      { origin: "user", instanceId: instanceId() },
    );
    await cycle();
    expect(remote.pushes).toEqual([]);
  });

  test("a local rename is pushed once, the echo is ignored", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "A2" }, USER);
    await cycle();
    expect(remote.pushes).toEqual([{ kind: "update", remoteId: "1", patch: { title: "A2" } }]);
    await cycle();
    expect(remote.pushes).toHaveLength(1);
  });

  test("offline: the outbox waits with backoff, then resumes", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "setStatus", ticketId: t?.id ?? "", statusId: "done" }, USER);
    remote.failNext(new KiboError("REMOTE_UNAVAILABLE", "offline"));
    await cycle();
    expect(engine.state(host.projectId).pending).toEqual([t?.id ?? ""]);
    expect(engine.state(host.projectId).errors).toEqual([]);
    await cycle();
    expect(remote.issues.get(1)?.fields.closed).toBe(false);
    host.clock.now += 5_000;
    await cycle();
    expect(remote.issues.get(1)?.fields.closed).toBe(true);
    expect(engine.state(host.projectId).pending).toEqual([]);
  });

  test("a rejected change is kept until the user retries or drops it", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "B" }, USER);
    remote.failNext(new KiboError("REMOTE_REJECTED", "github 422: Validation Failed"));
    await cycle();
    const [error] = engine.state(host.projectId).errors;
    expect(error).toMatchObject({ ticketId: t?.id, code: "REMOTE_REJECTED" });
    engine.resolveOutbox(host.projectId, error?.outboxId ?? 0, "retry");
    await cycle();
    expect(remote.issues.get(1)?.fields.title).toBe("B");
  });

  test("a deleted issue breaks the link without touching the ticket", async () => {
    remote.add({ title: "A" });
    await cycle();
    const issue = remote.issues.get(1);
    if (issue) issue.gone = true;
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "B" }, USER);
    await cycle();
    expect(tickets()[0]?.externalRefs[0]).toMatchObject({ number: 1, url: null });
    expect(engine.state(host.projectId).pending).toEqual([]);
  });

  test("an uncertain create blocks imports until it resolves", async () => {
    host.command(
      host.projectId,
      { method: "createTicket", title: "Incertaine" },
      { origin: "user", instanceId: instanceId() },
    );
    remote.failNext(new KiboError("TIMEOUT", "no answer"));
    await cycle();
    remote.add({ title: "Venue d'ailleurs" });
    await cycle();
    expect(tickets().map((t) => t.title)).toEqual(["Incertaine"]);
    host.clock.now += 5_000;
    await cycle();
    await cycle();
    expect(
      tickets()
        .map((t) => t.title)
        .sort(),
    ).toEqual(["Incertaine", "Venue d'ailleurs"]);
    expect(remote.pushes.filter((p) => p.kind === "create").at(-1)).toMatchObject({
      since: expect.any(String),
    });
  });
});

describe("conflicts, limits and ownership", () => {
  test("both sides changed: GitHub wins, the conflict is logged and broadcast", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "Local" }, USER);
    remote.edit(1, { title: "Distant" });
    remote.failNext(new KiboError("REMOTE_UNAVAILABLE", "flaky"));
    await cycle();
    expect(tickets()[0]?.title).toBe("Distant");
    expect(host.events).toContainEqual({
      type: "sync.conflict",
      projectId: host.projectId,
      ticketKey: "KIB-1",
      field: "title",
    });
    const logged = JSON.stringify(host.db.query("SELECT message FROM integration_events").all());
    expect(logged).toContain("Local");
  });

  test("a paused rate limit skips the pull without calling the adapter", async () => {
    const pausedUntil = host.now() + 600_000;
    const gate = { blockedUntil: () => pausedUntil };
    const paused = createSyncEngine({
      host,
      store,
      runner: remote,
      gate,
      events: createEventLog(host.db, createRedactor(), host.now),
      redact: (t) => t,
    });
    await expect(paused.cycle(host.projectId, "b1")).rejects.toThrow("RATE_LIMITED");
    expect(remote.pulls).toBe(0);
    expect(paused.state(host.projectId).bindings[0]?.resumeAt).toBeGreaterThan(host.now());
  });

  test("only the runner machine syncs a binding", () => {
    expect(engine.runnable()).toEqual([{ projectId: host.projectId, bindingId: "b1" }]);
    host.command(
      host.projectId,
      { method: "addBinding", binding: { ...binding, id: "b2", runner: "lea" } },
      USER,
    );
    expect(engine.runnable()).toEqual([{ projectId: host.projectId, bindingId: "b1" }]);
  });

  test("deleting a linked ticket forgets it locally and never closes the issue", async () => {
    remote.add({ title: "A" });
    await cycle();
    host.command(host.projectId, { method: "deleteTicket", ticketId: tickets()[0]?.id ?? "" }, USER);
    await cycle();
    expect(remote.pushes).toEqual([]);
    expect(remote.issues.get(1)?.fields.closed).toBe(false);
    expect(tickets()).toEqual([]);
  });
});
