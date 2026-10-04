import { describe, expect, test } from "bun:test";
import {
  type Binding,
  BuiltinEntityType,
  type ComponentCall,
  type ExternalRef,
  type GrantedPermissions,
} from "@kibo/schema";
import { missingPermission } from "./gate";
import { granted, refused, testGate } from "./gate-test-kit";
import { createQuotas } from "./quotas";

describe("componentCall checks, in order", () => {
  test("1. the instance must exist", async () => {
    const { gate: g, events } = testGate();
    await refused(g.call("p1", "ghost", { kind: "list", entity: "ticket" }), "NOT_FOUND");
    expect(events.list().map((e) => e.code)).toEqual(["NOT_FOUND"]);
  });
  test("2. a third-party version must be approved", async () => {
    const { gate: g, handled } = testGate();
    await refused(g.call("p1", "untrusted", { kind: "list", entity: "ticket" }), "TRUST_REQUIRED");
    expect(handled).toEqual([]);
  });
  test("3. granted permissions decide, not the manifest on disk", async () => {
    const { gate: g, events, handled } = testGate();
    await g.call("p1", "thirdparty", { kind: "list", entity: "ticket" });
    await refused(g.call("p1", "thirdparty", { kind: "list", entity: "link" }), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "thirdparty", { kind: "run", command: { method: "deleteTicket", ticketId: "t" } }),
      "PERMISSION_DENIED",
    );
    await refused(g.call("p1", "thirdparty", { kind: "notes.read", path: "a.md" }), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "thirdparty", {
        kind: "fetch",
        url: "https://example.com",
        init: { method: "GET", headers: {} },
      }),
      "PERMISSION_DENIED",
    );
    await g.call("p1", "thirdparty", { kind: "data.keys" });
    await g.call("p1", "thirdparty", {
      kind: "fetch",
      url: "https://api.github.com/graphql",
      init: { method: "POST", headers: {} },
    });
    await g.call("p1", "thirdparty", { kind: "action", name: "ping", input: null });
    expect(handled).toEqual(["list", "data", "fetch:api.github.com/graphql", "action"]);
    expect(events.list()).toHaveLength(4);
    expect(events.list()[0]).toEqual({
      at: 42,
      projectId: "p1",
      instanceId: "thirdparty",
      ref: "evil@0.1.0",
      kind: "list",
      code: "PERMISSION_DENIED",
      count: 1,
    });
  });
  test("reserved commands are refused for everyone, built-ins included", async () => {
    const { gate: g, handled } = testGate();
    const reserved: ComponentCall = {
      kind: "run",
      command: { method: "setInstanceData", instanceId: "x", key: "k", value: 1 },
    };
    await refused(g.call("p1", "thirdparty", reserved), "PERMISSION_DENIED");
    await refused(g.call("p1", "builtin", reserved), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "builtin", {
        kind: "run",
        command: { method: "addInstance", pageId: "pg", component: "x@1.0.0" },
      }),
      "PERMISSION_DENIED",
    );
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
    const forged: ComponentCall = {
      kind: "run",
      command: { method: "upsertExternalRef", ticketId: "t1", ref },
    };
    const commands: ComponentCall[] = [
      forged,
      { kind: "run", command: { method: "removeExternalRef", ticketId: "t1", kind: "github_pr", key: "x" } },
      { kind: "run", command: { method: "addBinding", binding } },
      { kind: "run", command: { method: "removeBinding", bindingId: "b1" } },
      {
        kind: "run",
        command: { method: "importExternalTicket", title: "X", ref },
      },
    ];
    for (const call of commands) {
      await refused(g.call("p1", "thirdparty", call), "PERMISSION_DENIED");
      await refused(g.call("p1", "builtin", call), "PERMISSION_DENIED");
    }
    const everything: GrantedPermissions = { ...granted, writes: [...BuiltinEntityType.options] };
    expect(missingPermission(everything, forged)).toBe("write:upsertExternalRef");
    expect(handled).toEqual([]);
  });
  test("built-ins skip trust and grant checks but not the fetch guard", async () => {
    const { gate: g, handled } = testGate();
    await g.call("p1", "builtin", { kind: "notes.read", path: "a.md" });
    await g.call("p1", "builtin", {
      kind: "fetch",
      url: "https://example.com",
      init: { method: "GET", headers: {} },
    });
    expect(handled).toEqual(["notes", "fetch:any"]);
  });
  test("5. quotas refuse bursts and are journaled", async () => {
    const { gate: g, events } = testGate(createQuotas({ callsPerSecond: 1, now: () => 0 }));
    await g.call("p1", "thirdparty", { kind: "data.keys" });
    await refused(g.call("p1", "thirdparty", { kind: "data.keys" }), "RATE_LIMITED");
    expect(events.list().map((e) => e.code)).toEqual(["RATE_LIMITED"]);
  });
});

describe("project files", () => {
  test("third parties need cap:assets, refusals are journaled", async () => {
    const { gate: g, events, handled } = testGate();
    await refused(g.call("p1", "thirdparty", { kind: "assets.list" }), "PERMISSION_DENIED");
    await refused(g.call("p1", "thirdparty", { kind: "assets.url", name: "robot.glb" }), "PERMISSION_DENIED");
    expect(handled).toEqual([]);
    expect(events.list().map((e) => [e.kind, e.code])).toEqual([
      ["assets.list", "PERMISSION_DENIED"],
      ["assets.url", "PERMISSION_DENIED"],
    ]);
  });
  test("a granted capability reaches the handler with the instance", async () => {
    const { gate: g, handled } = testGate(createQuotas(), { ...granted, capabilities: ["assets"] });
    await g.call("p1", "thirdparty", { kind: "assets.list" });
    await g.call("p1", "thirdparty", { kind: "assets.url", name: "robot.glb" });
    expect(handled).toEqual(["assets:thirdparty:assets.list", "assets:thirdparty:assets.url"]);
  });
  test("built-ins pass without a check", async () => {
    const { gate: g, handled } = testGate();
    await g.call("p1", "builtin", { kind: "assets.url", name: "robot.glb" });
    expect(handled).toEqual(["assets:builtin:assets.url"]);
  });
});
