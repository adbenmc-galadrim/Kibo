import { describe, expect, test } from "bun:test";
import type { Binding, ComponentCall, ExternalRef } from "@kibo/schema";
import { refused, testGate } from "./gate-test-kit";
import { createQuotas } from "./quotas";

describe("componentCall checks, in order", () => {
  test("1. the instance must exist", async () => {
    const { gate: g, events } = testGate();
    await refused(g.call("p1", "ghost", { kind: "list", entity: "ticket" }), "NOT_FOUND");
    expect(events.list().map((e) => e.code)).toEqual(["NOT_FOUND"]);
  });
  test("2. a call for a non-builtin ref is refused with NOT_FOUND", async () => {
    const { gate: g, events, handled } = testGate();
    await refused(g.call("p1", "thirdparty", { kind: "list", entity: "ticket" }), "NOT_FOUND");
    await refused(g.call("p1", "thirdparty", { kind: "data.keys" }), "NOT_FOUND");
    expect(handled).toEqual([]);
    expect(events.list().map((e) => [e.ref, e.kind, e.code])).toEqual([
      ["evil@0.1.0", "list", "NOT_FOUND"],
      ["evil@0.1.0", "data.keys", "NOT_FOUND"],
    ]);
  });
  test("t3 calls are allowed to built-ins only", async () => {
    const { gate: g, handled } = testGate();
    await refused(g.call("p1", "thirdparty", { kind: "t3.status" }), "NOT_FOUND");
    expect(handled).toEqual([]);
    await g.call("p1", "builtin", { kind: "t3.status" });
    await g.call("p1", "builtin", { kind: "t3.launch", ticketKey: "SILO-1" });
    expect(handled).toEqual(["t3.status:p1", "t3.launch:p1"]);
  });
  test("reserved commands are refused for every built-in", async () => {
    const { gate: g, handled } = testGate();
    const reserved: ComponentCall[] = [
      { kind: "run", command: { method: "setInstanceData", instanceId: "x", key: "k", value: 1 } },
      { kind: "run", command: { method: "addInstance", pageId: "pg", component: "x@1.0.0" } },
    ];
    for (const call of reserved) await refused(g.call("p1", "builtin", call), "PERMISSION_DENIED");
    expect(handled).toEqual([]);
  });
  test("the ticket progress is written by the daemon only, never by a component", async () => {
    const { gate: g, handled } = testGate();
    const progress: ComponentCall = {
      kind: "run",
      command: {
        method: "setTicketProgress",
        ticketId: "t1",
        runId: "r1",
        at: 1,
        plan: [{ id: "s1", title: "Lire", status: "doing", note: null }],
      },
    };
    await refused(g.call("p1", "builtin", progress), "PERMISSION_DENIED");
    expect(handled).toEqual([]);
  });
  test("external refs and bindings are refused to every component", async () => {
    const { gate: g, handled } = testGate();
    const binding: Binding = {
      id: "b1",
      adapter: "github-issues",
      config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
      createdBy: "adam",
      runner: "adam",
    };
    const ref: ExternalRef = {
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: null,
      nodeId: null,
      url: null,
    };
    const commands: ComponentCall[] = [
      { kind: "run", command: { method: "upsertExternalRef", ticketId: "t1", ref } },
      { kind: "run", command: { method: "removeExternalRef", ticketId: "t1", kind: "github_pr", key: "x" } },
      { kind: "run", command: { method: "addBinding", binding } },
      { kind: "run", command: { method: "removeBinding", bindingId: "b1" } },
      { kind: "run", command: { method: "importExternalTicket", title: "X", ref } },
    ];
    for (const call of commands) await refused(g.call("p1", "builtin", call), "PERMISSION_DENIED");
    expect(handled).toEqual([]);
  });
  test("a built-in fetch reaches the fetch guard", async () => {
    const { gate: g, handled } = testGate();
    await g.call("p1", "builtin", {
      kind: "fetch",
      url: "https://example.com",
      init: { method: "GET", headers: {} },
    });
    expect(handled).toEqual(["fetch:https://example.com"]);
  });
  test("a built-in has no backend to call", async () => {
    const { gate: g, handled } = testGate();
    await refused(g.call("p1", "builtin", { kind: "action", name: "ping", input: null }), "NOT_FOUND");
    expect(handled).toEqual([]);
  });
  test("5. quotas refuse bursts and are journaled", async () => {
    const { gate: g, events } = testGate(createQuotas({ callsPerSecond: 1, now: () => 0 }));
    await g.call("p1", "builtin", { kind: "data.keys" });
    await refused(g.call("p1", "builtin", { kind: "data.keys" }), "RATE_LIMITED");
    expect(events.list().map((e) => e.code)).toEqual(["RATE_LIMITED"]);
  });
});

describe("project files, design and embedded frames", () => {
  const frameCall: ComponentCall = {
    kind: "design.frame",
    url: "https://www.figma.com/design/AbC123xyz/K?node-id=1-2",
    refresh: false,
  };
  test("a built-in reaches the files and design handlers with its instance", async () => {
    const { gate: g, handled } = testGate();
    await g.call("p1", "builtin", { kind: "assets.url", name: "robot.glb" });
    await g.call("p1", "builtin", frameCall);
    await g.call("p1", "builtin", { kind: "design.storybooks" });
    expect(handled).toEqual([
      "assets:builtin:assets.url",
      "design:builtin:design.frame",
      "design:builtin:design.storybooks",
    ]);
  });
  test("design.frame is rate limited per instance", async () => {
    const { gate: g, events, handled } = testGate(createQuotas({ now: () => 0 }));
    for (let i = 0; i < 30; i++) await g.call("p1", "builtin", frameCall);
    await refused(g.call("p1", "builtin", frameCall), "RATE_LIMITED");
    expect(handled).toHaveLength(30);
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([["design.frame", "RATE_LIMITED"]]);
  });
});
