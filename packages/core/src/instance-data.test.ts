import { describe, expect, test } from "bun:test";
import type { Instance, Page } from "@kibo/schema";
import fc from "fast-check";
import { assertShellCommand, executeProjectCommand } from "./commands";
import { readInstanceData, writeInstanceData } from "./instance-data";
import { getInstance, removeInstance } from "./instances";
import { createProjectDoc } from "./project";

function setup() {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  const page = executeProjectCommand(doc, { method: "addPage", title: "Board", kind: "dashboard" }) as Page;
  const inst = executeProjectCommand(doc, {
    method: "addInstance",
    pageId: page.id,
    component: "hello@0.1.0",
  }) as Instance;
  return { doc, inst, page };
}

describe("instance data", () => {
  test("keys are set, read and deleted", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "count", 3);
    writeInstanceData(doc, inst.id, "list", [1, "a"]);
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 3, list: [1, "a"] });
    writeInstanceData(doc, inst.id, "count", null);
    expect(readInstanceData(doc, inst.id)).toEqual({ list: [1, "a"] });
  });
  test("invalid keys, unknown instances and oversize data are refused without change", () => {
    const { doc, inst } = setup();
    expect(() => writeInstanceData(doc, inst.id, "../x", 1)).toThrow("INVALID_INPUT");
    expect(() => writeInstanceData(doc, "nope", "k", 1)).toThrow("NOT_FOUND");
    writeInstanceData(doc, inst.id, "a", "x".repeat(200_000));
    expect(() => writeInstanceData(doc, inst.id, "b", "x".repeat(70_000))).toThrow("QUOTA_EXCEEDED");
    expect(Object.keys(readInstanceData(doc, inst.id))).toEqual(["a"]);
  });
  test("removing an instance removes its data", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "k", 1);
    removeInstance(doc, inst.id);
    expect(readInstanceData(doc, inst.id)).toEqual({});
  });
  test("deleting a page removes the data of its instances", () => {
    const { doc, inst, page } = setup();
    writeInstanceData(doc, inst.id, "k", 1);
    executeProjectCommand(doc, { method: "deletePage", pageId: page.id });
    expect(readInstanceData(doc, inst.id)).toEqual({});
  });
  test("reads match a plain model after any sequence of writes and a snapshot", () => {
    const op = fc.record({
      key: fc.constantFrom("a", "b", "c.d", "e_f"),
      value: fc.option(fc.oneof(fc.integer(), fc.string(), fc.boolean()), { nil: null }),
    });
    fc.assert(
      fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
        const { doc, inst } = setup();
        const model: Record<string, unknown> = {};
        for (const { key, value } of ops) {
          writeInstanceData(doc, inst.id, key, value);
          if (value === null) delete model[key];
          else model[key] = value;
        }
        const copy = createProjectDoc({ id: "q", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
        copy.import(doc.export({ mode: "snapshot" }));
        expect(readInstanceData(copy, inst.id)).toEqual(model);
      }),
      { numRuns: 50 },
    );
  });
});

describe("reserved commands", () => {
  test("setInstanceComponent swaps ref, config and data in one step", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "old", 1);
    const next = executeProjectCommand(doc, {
      method: "setInstanceComponent",
      instanceId: inst.id,
      component: "hello@0.2.0",
      config: { mode: "compact" },
      data: { migrated: true },
    }) as Instance;
    expect(next.component).toBe("hello@0.2.0");
    expect(getInstance(doc, inst.id).config).toEqual({ mode: "compact" });
    expect(readInstanceData(doc, inst.id)).toEqual({ migrated: true });
  });
  test("a bad ref or oversize data leaves the instance untouched", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "keep", 1);
    expect(() =>
      executeProjectCommand(doc, {
        method: "setInstanceComponent",
        instanceId: inst.id,
        component: "hello@0.2.0",
        config: {},
        data: { big: "x".repeat(300_000) },
      }),
    ).toThrow("QUOTA_EXCEEDED");
    expect(() =>
      executeProjectCommand(doc, {
        method: "setInstanceComponent",
        instanceId: inst.id,
        component: "not a ref",
        config: {},
        data: {},
      }),
    ).toThrow("INVALID_INPUT");
    expect(getInstance(doc, inst.id).component).toBe("hello@0.1.0");
    expect(readInstanceData(doc, inst.id)).toEqual({ keep: 1 });
  });
  test("null data keeps the existing data", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "keep", 1);
    executeProjectCommand(doc, {
      method: "setInstanceComponent",
      instanceId: inst.id,
      component: "hello@0.2.0",
      config: {},
      data: null,
    });
    expect(readInstanceData(doc, inst.id)).toEqual({ keep: 1 });
  });
  test("setInstanceConfig and setInstanceData go through the command bus", () => {
    const { doc, inst } = setup();
    executeProjectCommand(doc, { method: "setInstanceConfig", instanceId: inst.id, config: { a: 1 } });
    executeProjectCommand(doc, { method: "setInstanceData", instanceId: inst.id, key: "k", value: "v" });
    expect(getInstance(doc, inst.id).config).toEqual({ a: 1 });
    expect(readInstanceData(doc, inst.id)).toEqual({ k: "v" });
  });
  test("the shell may not send daemon-only commands", () => {
    expect(() =>
      assertShellCommand({
        method: "setInstanceComponent",
        instanceId: "i",
        component: "hello@0.2.0",
        config: {},
        data: null,
      }),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      assertShellCommand({ method: "setInstanceData", instanceId: "i", key: "k", value: 1 }),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      assertShellCommand({ method: "setInstanceConfig", instanceId: "i", config: {} }),
    ).not.toThrow();
    expect(() => assertShellCommand({ method: "removeInstance", instanceId: "i" })).not.toThrow();
  });
});
