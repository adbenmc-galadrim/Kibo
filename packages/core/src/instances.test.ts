import { describe, expect, test } from "bun:test";
import { COMMAND_WRITES, isReservedCommand, KiboError, type Layout, layoutFor } from "@kibo/schema";
import {
  addInstance,
  addPage,
  assertShellCommand,
  createProjectDoc,
  executeProjectCommand,
  getInstance,
  listInstances,
  setInstanceLayout,
} from "./index";

test("instances stored before v1.0 are listed with componentHash null", () => {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#3B82F6" });
  doc.getMap("instances").set("i1", {
    id: "i1",
    pageId: "pg1",
    component: "burndown@0.3.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  });
  expect(listInstances(doc)[0]?.componentHash).toBeNull();
});

const META = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#3B82F6" };

describe("setInstanceLayout", () => {
  test("moves and resizes within the grid, as a format, without overlap", () => {
    const doc = createProjectDoc(META);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const a = addInstance(doc, {
      pageId: page.id,
      component: "kanban@1.0.0",
      layout: layoutFor("large", 0, 0),
    });
    const b = addInstance(doc, {
      pageId: page.id,
      component: "tickets@1.0.0",
      layout: layoutFor("large", 6, 0),
    });
    expect(setInstanceLayout(doc, a.id, layoutFor("medium", 0, 6)).layout).toEqual({
      x: 0,
      y: 6,
      w: 6,
      h: 3,
    });
    expect(getInstance(doc, a.id).layout).toEqual({ x: 0, y: 6, w: 6, h: 3 });
    expect(() => setInstanceLayout(doc, a.id, { x: 0, y: 0, w: 5, h: 5 })).toThrow(/not a component format/);
    expect(() => setInstanceLayout(doc, a.id, layoutFor("half", 1, 0))).toThrow(/outside the grid/);
    expect(() => setInstanceLayout(doc, a.id, layoutFor("half", 0, 395))).toThrow(/outside the grid/);
    expect(() => setInstanceLayout(doc, a.id, layoutFor("large", 6, 3))).toThrow(
      new RegExp(`overlaps instance ${b.id}`),
    );
    expect(() => setInstanceLayout(doc, "nope", layoutFor("small", 0, 0))).toThrow(/not found/);
    expect(
      executeProjectCommand(doc, {
        method: "setInstanceLayout",
        instanceId: b.id,
        layout: layoutFor("half", 0, 9),
      }),
    ).toMatchObject({ layout: { x: 0, y: 9, w: 12, h: 6 } });
  });

  test("refusals carry a stable code and leave the instance untouched", () => {
    const doc = createProjectDoc(META);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const a = addInstance(doc, {
      pageId: page.id,
      component: "kanban@1.0.0",
      layout: layoutFor("large", 0, 0),
    });
    addInstance(doc, { pageId: page.id, component: "tickets@1.0.0", layout: layoutFor("large", 6, 0) });
    const version = doc.version().toJSON();
    for (const layout of [{ x: 0, y: 0, w: 5, h: 5 }, layoutFor("half", 1, 0), layoutFor("large", 3, 0)]) {
      expect(codeOf(() => setInstanceLayout(doc, a.id, layout))).toBe("INVALID_INPUT");
    }
    expect(codeOf(() => setInstanceLayout(doc, "nope", layoutFor("small", 0, 0)))).toBe("NOT_FOUND");
    expect(doc.version().toJSON()).toEqual(version);
    expect(getInstance(doc, a.id).layout).toEqual(layoutFor("large", 0, 0));
  });

  test("an instance may keep its place, and other pages never collide", () => {
    const doc = createProjectDoc(META);
    const one = addPage(doc, { title: "Un", kind: "dashboard", parentId: null });
    const two = addPage(doc, { title: "Deux", kind: "dashboard", parentId: null });
    const a = addInstance(doc, {
      pageId: one.id,
      component: "kanban@1.0.0",
      layout: layoutFor("large", 0, 0),
    });
    addInstance(doc, { pageId: two.id, component: "kanban@1.0.0", layout: layoutFor("half", 0, 0) });
    expect(setInstanceLayout(doc, a.id, layoutFor("large", 0, 0)).layout).toEqual(layoutFor("large", 0, 0));
    expect(setInstanceLayout(doc, a.id, layoutFor("half", 0, 0)).layout).toEqual(layoutFor("half", 0, 0));
  });

  test("addInstance applies the same rules to an explicit layout, and keeps its default otherwise", () => {
    const doc = createProjectDoc(META);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const add = (layout?: Layout) => addInstance(doc, { pageId: page.id, component: "kanban@1.0.0", layout });
    add(layoutFor("large", 0, 0));
    expect(() => add({ x: 0, y: 6, w: 4, h: 4 })).toThrow(/not a component format/);
    expect(() => add(layoutFor("large", 9, 6))).toThrow(/outside the grid/);
    expect(() => add(layoutFor("small", 3, 3))).toThrow(/overlaps instance/);
    expect(add().layout).toEqual(layoutFor("half", 0, 0));
    expect(listInstances(doc, page.id)).toHaveLength(2);
  });

  test("is a shell command, refused to components", () => {
    const cmd = { method: "setInstanceLayout", instanceId: "i", layout: layoutFor("small", 0, 0) } as const;
    expect(() => assertShellCommand(cmd)).not.toThrow();
    expect(isReservedCommand(cmd.method)).toBe(true);
    expect(COMMAND_WRITES.setInstanceLayout).toBeNull();
  });
});

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof KiboError) return e.code;
    throw e;
  }
  throw new Error("expected a KiboError");
}
