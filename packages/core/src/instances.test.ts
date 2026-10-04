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
  removeInstance,
  setInstanceLayout,
  setPageLayout,
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
  test("moves and resizes within the grid, as a format, and the others flow around it", () => {
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
      y: 0,
      w: 6,
      h: 3,
    });
    expect(getInstance(doc, a.id).layout).toEqual({ x: 0, y: 0, w: 6, h: 3 });
    expect(setInstanceLayout(doc, a.id, { x: 0, y: 0, w: 5, h: 5 }).layout).toEqual({
      x: 0,
      y: 0,
      w: 5,
      h: 5,
    });
    expect(() => setInstanceLayout(doc, a.id, layoutFor("half", 1, 0))).toThrow(/outside the grid/);
    expect(() => setInstanceLayout(doc, a.id, layoutFor("half", 0, 395))).toThrow(/outside the grid/);
    const moved = setInstanceLayout(doc, a.id, layoutFor("large", 6, 0));
    expect(moved.layout).toEqual({ x: 6, y: 0, w: 6, h: 6 });
    expect(getInstance(doc, b.id).layout.y).toBe(6);
    expect(() => setInstanceLayout(doc, "nope", layoutFor("small", 0, 0))).toThrow(/not found/);
    expect(
      executeProjectCommand(doc, {
        method: "setInstanceLayout",
        instanceId: b.id,
        layout: layoutFor("half", 0, 9),
      }),
    ).toMatchObject({ layout: { x: 0, y: 6, w: 12, h: 6 } });
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
    for (const layout of [{ x: 8, y: 0, w: 5, h: 5 }, layoutFor("half", 1, 0)]) {
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

  test("addInstance applies the same rules to an explicit layout, and adds below the others otherwise", () => {
    const doc = createProjectDoc(META);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const add = (layout?: Layout) => addInstance(doc, { pageId: page.id, component: "kanban@1.0.0", layout });
    const large = add(layoutFor("large", 0, 0));
    expect(() => add(layoutFor("large", 9, 6))).toThrow(/outside the grid/);
    expect(add(layoutFor("small", 3, 3)).layout).toEqual(layoutFor("small", 3, 0));
    expect(getInstance(doc, large.id).layout).toEqual(layoutFor("large", 0, 3));
    expect(add().layout).toEqual(layoutFor("half", 0, 9));
    expect(add({ x: 6, y: 3, w: 4, h: 5 }).layout).toEqual({ x: 6, y: 0, w: 4, h: 5 });
    expect(listInstances(doc, page.id)).toHaveLength(4);
  });

  test("is a shell command, refused to components", () => {
    const cmd = { method: "setInstanceLayout", instanceId: "i", layout: layoutFor("small", 0, 0) } as const;
    expect(() => assertShellCommand(cmd)).not.toThrow();
    expect(isReservedCommand(cmd.method)).toBe(true);
    expect(COMMAND_WRITES.setInstanceLayout).toBeNull();
  });
});

describe("compaction", () => {
  const fresh = () => {
    const doc = createProjectDoc(META);
    const pageId = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null }).id;
    return { doc, pageId };
  };
  const layoutsOf = (list: readonly { id: string; layout: Layout }[]) =>
    Object.fromEntries(list.map((i) => [i.id, i.layout]));

  test("every write compacts the page: a gap closes, a removal pulls the rows up, a stacked add goes to the bottom", () => {
    const { doc, pageId } = fresh();
    const a = addInstance(doc, { pageId, component: "kanban@1.0.0", layout: layoutFor("large", 0, 0) });
    const b = addInstance(doc, { pageId, component: "tickets@1.0.0", layout: layoutFor("medium", 6, 0) });
    const c = addInstance(doc, { pageId, component: "notes@1.0.0", layout: layoutFor("medium", 6, 8) });
    expect(c.layout).toEqual({ x: 6, y: 3, w: 6, h: 3 });
    expect(getInstance(doc, c.id).layout).toEqual({ x: 6, y: 3, w: 6, h: 3 });
    removeInstance(doc, b.id);
    expect(getInstance(doc, c.id).layout).toEqual({ x: 6, y: 0, w: 6, h: 3 });
    const d = addInstance(doc, { pageId, component: "graph@1.0.0" });
    expect(getInstance(doc, d.id).layout).toEqual({ x: 0, y: 6, w: 12, h: 6 });
    expect(getInstance(doc, a.id).layout).toEqual({ x: 0, y: 0, w: 6, h: 6 });
  });

  test("setPageLayout pins the listed layouts, lets the others flow from their stored place, and refuses bad input", () => {
    const { doc, pageId } = fresh();
    const a = addInstance(doc, { pageId, component: "kanban@1.0.0", layout: layoutFor("large", 0, 0) });
    const b = addInstance(doc, { pageId, component: "tickets@1.0.0", layout: layoutFor("medium", 6, 0) });
    const result = setPageLayout(doc, pageId, [{ instanceId: a.id, layout: layoutFor("half", 0, 0) }]);
    expect(layoutsOf(result)).toEqual({
      [a.id]: { x: 0, y: 0, w: 12, h: 6 },
      [b.id]: { x: 6, y: 6, w: 6, h: 3 },
    });
    expect(layoutsOf(listInstances(doc, pageId))).toEqual(layoutsOf(result));
    const version = doc.version().toJSON();
    expect(() => setPageLayout(doc, pageId, [])).toThrow(/at least one layout/);
    expect(() =>
      setPageLayout(doc, pageId, [{ instanceId: a.id, layout: { x: 8, y: 0, w: 6, h: 3 } }]),
    ).toThrow(/outside the grid/);
    expect(() =>
      setPageLayout(doc, pageId, [
        { instanceId: a.id, layout: layoutFor("large", 0, 0) },
        { instanceId: b.id, layout: layoutFor("large", 0, 0) },
      ]),
    ).toThrow(/overlap/);
    expect(
      codeOf(() => setPageLayout(doc, pageId, [{ instanceId: "nope", layout: layoutFor("large", 0, 0) }])),
    ).toBe("NOT_FOUND");
    expect(
      codeOf(() => setPageLayout(doc, "missing", [{ instanceId: a.id, layout: layoutFor("large", 0, 0) }])),
    ).toBe("NOT_FOUND");
    const other = addPage(doc, { title: "Autre", kind: "dashboard", parentId: null });
    const afterAdd = doc.version().toJSON();
    expect(
      codeOf(() => setPageLayout(doc, other.id, [{ instanceId: a.id, layout: layoutFor("large", 0, 0) }])),
    ).toBe("INVALID_INPUT");
    expect(() =>
      setPageLayout(doc, other.id, [{ instanceId: a.id, layout: layoutFor("large", 0, 0) }]),
    ).toThrow(/not on page/);
    expect(doc.version().toJSON()).toEqual(afterAdd);
    expect(version).not.toEqual(afterAdd);
    expect(
      executeProjectCommand(doc, {
        method: "setPageLayout",
        pageId,
        layouts: [{ instanceId: a.id, layout: layoutFor("large", 0, 0) }],
      }),
    ).toHaveLength(2);
    expect(isReservedCommand("setPageLayout")).toBe(true);
    expect(COMMAND_WRITES.setPageLayout).toBeNull();
    expect(() => assertShellCommand({ method: "setPageLayout", pageId, layouts: [] })).not.toThrow();
  });

  test("setPageLayout keeps a move made meanwhile by another member on a widget it does not list", () => {
    const { doc, pageId } = fresh();
    const a = addInstance(doc, { pageId, component: "kanban@1.0.0", layout: layoutFor("large", 0, 0) });
    const b = addInstance(doc, { pageId, component: "tickets@1.0.0", layout: layoutFor("medium", 6, 0) });
    const c = addInstance(doc, { pageId, component: "notes@1.0.0", layout: layoutFor("medium", 6, 3) });
    setInstanceLayout(doc, c.id, layoutFor("medium", 6, 0));
    expect(getInstance(doc, b.id).layout).toEqual(layoutFor("medium", 6, 3));
    setPageLayout(doc, pageId, [{ instanceId: a.id, layout: layoutFor("large", 0, 6) }]);
    expect(layoutsOf(listInstances(doc, pageId))).toEqual({
      [a.id]: layoutFor("large", 0, 0),
      [b.id]: layoutFor("medium", 6, 3),
      [c.id]: layoutFor("medium", 6, 0),
    });
  });

  test("setPageLayout writes the whole page in a single commit", () => {
    const { doc, pageId } = fresh();
    const a = addInstance(doc, { pageId, component: "kanban@1.0.0", layout: layoutFor("large", 0, 0) });
    const b = addInstance(doc, { pageId, component: "tickets@1.0.0", layout: layoutFor("large", 6, 0) });
    let commits = 0;
    const unsubscribe = doc.subscribe((event) => {
      if (event.by === "local") commits++;
    });
    setPageLayout(doc, pageId, [
      { instanceId: a.id, layout: layoutFor("large", 6, 0) },
      { instanceId: b.id, layout: layoutFor("large", 0, 0) },
    ]);
    unsubscribe();
    expect(commits).toBe(1);
    expect(getInstance(doc, a.id).layout).toEqual(layoutFor("large", 6, 0));
    expect(getInstance(doc, b.id).layout).toEqual(layoutFor("large", 0, 0));
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
