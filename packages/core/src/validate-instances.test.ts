import { describe, expect, test } from "bun:test";
import {
  COMPONENT_FORMATS,
  type Instance,
  inGrid,
  isFormatLayout,
  KiboError,
  type Layout,
  layoutFor,
  overlaps,
} from "@kibo/schema";
import fc from "fast-check";
import { LoroDoc, LoroMap } from "loro-crdt";
import {
  addInstance,
  addPage,
  createProjectDoc,
  instancesSnapshotViolation,
  instancesUpdateViolation,
  listInstances,
  setInstanceLayout,
  type UpdateAuthor,
  validateProjectUpdate,
  validateSharedSnapshot,
} from "./index";

const META = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#3B82F6" };
const EDITOR: UpdateAuthor = { userId: "u1", role: "editor" };

function projectWith(layout: Layout): { doc: LoroDoc; instance: Instance } {
  const doc = createProjectDoc(META);
  doc.getMap("meta").delete("folder");
  const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
  return { doc, instance: addInstance(doc, { pageId: page.id, component: "kanban@1.0.0", layout }) };
}

function edited(before: LoroDoc, edit: (instances: LoroMap) => void): LoroDoc {
  const after = before.fork();
  edit(after.getMap("instances"));
  after.commit();
  return after;
}

const withLayout = (before: LoroDoc, instance: Instance, layout: Layout): LoroDoc =>
  edited(before, (m) => m.set(instance.id, { ...instance, layout }));

function docWithRawInstance(layout: Layout): { doc: LoroDoc; instance: Instance } {
  const { doc, instance } = projectWith(layoutFor("large", 0, 0));
  const legacy = { ...instance, id: "legacy", layout };
  doc.getMap("instances").set("legacy", legacy);
  doc.commit();
  return { doc, instance: legacy };
}

describe("instancesUpdateViolation", () => {
  test("a new or moved instance stored under its id, inside the grid, with a format size is accepted", () => {
    const { doc, instance } = projectWith(layoutFor("large", 0, 0));
    const added = edited(doc, (m) =>
      m.set("i2", { ...instance, id: "i2", layout: layoutFor("small", 9, 397) }),
    );
    expect(instancesUpdateViolation(doc, added)).toBeNull();
    expect(instancesUpdateViolation(doc, withLayout(doc, instance, layoutFor("full", 0, 391)))).toBeNull();
    expect(instancesUpdateViolation(doc, doc.fork())).toBeNull();
  });

  test("a layout that is not a format or leaves the grid is refused", () => {
    const { doc, instance } = projectWith(layoutFor("large", 0, 0));
    expect(instancesUpdateViolation(doc, withLayout(doc, instance, { x: 0, y: 0, w: 5, h: 5 }))).toBe(
      `instance ${instance.id}: layout is not a component format`,
    );
    expect(instancesUpdateViolation(doc, withLayout(doc, instance, { x: 8, y: 0, w: 6, h: 3 }))).toBe(
      `instance ${instance.id}: layout is outside the grid`,
    );
    expect(instancesUpdateViolation(doc, withLayout(doc, instance, layoutFor("half", 0, 395)))).toMatch(
      /outside the grid/,
    );
  });

  test("an instance must be a plain Instance stored under its own id", () => {
    const { doc, instance } = projectWith(layoutFor("large", 0, 0));
    expect(
      instancesUpdateViolation(
        doc,
        edited(doc, (m) => m.set("i9", { ...instance, id: "other" })),
      ),
    ).toBe("instance i9 is stored under another key");
    expect(
      instancesUpdateViolation(
        doc,
        edited(doc, (m) => m.set("i9", { id: "i9" })),
      ),
    ).toBe("instance i9 has an invalid value");
    expect(
      instancesUpdateViolation(
        doc,
        edited(doc, (m) => m.set(instance.id, "kanban")),
      ),
    ).toMatch(/invalid value/);
    expect(
      instancesUpdateViolation(
        doc,
        edited(doc, (m) => m.set(instance.id, { ...instance, layout: { ...instance.layout, x: -6 } })),
      ),
    ).toMatch(/invalid value/);
    expect(
      instancesUpdateViolation(
        doc,
        edited(doc, (m) => m.setContainer("i9", new LoroMap())),
      ),
    ).toBe("instance i9 must be a plain value");
  });

  test("a container written inside an existing container is refused", () => {
    const { doc } = projectWith(layoutFor("large", 0, 0));
    doc.getMap("instances").setContainer("box", new LoroMap());
    doc.commit();
    const untouched = edited(doc, () => {});
    expect(instancesUpdateViolation(doc, untouched)).toBeNull();
    const filled = edited(doc, (m) => {
      const box = m.get("box");
      if (box instanceof LoroMap) box.set("id", "box");
    });
    expect(instancesUpdateViolation(doc, filled)).toBe("instance box must be a plain value");
  });

  test("overlaps are accepted, removals too, and untouched legacy instances are not checked", () => {
    const { doc: legacy, instance } = docWithRawInstance({ x: 0, y: 0, w: 5, h: 5 });
    const after = edited(legacy, (m) =>
      m.set("i2", { ...instance, id: "i2", layout: layoutFor("small", 0, 0) }),
    );
    expect(instancesUpdateViolation(legacy, after)).toBeNull();
    expect(
      instancesUpdateViolation(
        legacy,
        edited(legacy, (m) => m.delete("legacy")),
      ),
    ).toBeNull();
    expect(
      instancesUpdateViolation(legacy, withLayout(legacy, instance, { x: 0, y: 6, w: 5, h: 5 })),
    ).toMatch(/not a component format/);
  });
});

describe("server rules", () => {
  test("validateProjectUpdate applies the instance rules", () => {
    const { doc, instance } = projectWith(layoutFor("large", 0, 0));
    const bad = withLayout(doc, instance, { x: 0, y: 0, w: 5, h: 5 });
    expect(validateProjectUpdate(doc, bad, EDITOR)).toEqual({
      ok: false,
      reason: `instance ${instance.id}: layout is not a component format`,
    });
    expect(validateProjectUpdate(doc, withLayout(doc, instance, layoutFor("half", 0, 6)), EDITOR)).toEqual({
      ok: true,
    });
  });

  test("validateSharedSnapshot checks every instance", () => {
    expect(validateSharedSnapshot(projectWith(layoutFor("large", 0, 0)).doc, "p1", "u1")).toEqual({
      ok: true,
    });
    const legacy = docWithRawInstance({ x: 0, y: 0, w: 5, h: 5 }).doc;
    expect(instancesSnapshotViolation(legacy)).toBe("instance legacy: layout is not a component format");
    expect(validateSharedSnapshot(legacy, "p1", "u1")).toMatchObject({ ok: false });
    const boxed = projectWith(layoutFor("large", 0, 0)).doc;
    boxed.getMap("instances").setContainer("box", new LoroMap());
    boxed.commit();
    expect(instancesSnapshotViolation(boxed)).toBe("instance box must be a plain value");
  });
});

const layoutOp = fc.record({
  format: fc.constantFrom(...COMPONENT_FORMATS),
  x: fc.nat(11),
  y: fc.nat(30),
  op: fc.constantFrom("add", "move"),
  target: fc.nat(10),
});
type LayoutOp = typeof layoutOp extends fc.Arbitrary<infer T> ? T : never;

function apply(doc: LoroDoc, pageId: string, op: LayoutOp): void {
  const layout = layoutFor(op.format, op.x, op.y);
  const existing = listInstances(doc, pageId);
  try {
    const target = existing[op.target % Math.max(existing.length, 1)];
    if (op.op === "add" || target === undefined) {
      addInstance(doc, { pageId, component: "kanban@1.0.0", layout });
    } else setInstanceLayout(doc, target.id, layout);
  } catch (e) {
    if (!(e instanceof KiboError && e.code === "INVALID_INPUT")) throw e;
  }
}

function overlapping(doc: LoroDoc, pageId: string): boolean {
  const list = listInstances(doc, pageId);
  return list.some((a, i) => list.slice(i + 1).some((b) => overlaps(a.layout, b.layout)));
}

function pushed(server: LoroDoc, client: LoroDoc): LoroDoc {
  const after = server.fork();
  after.import(client.export({ mode: "update", from: server.oplogVersion() }));
  return after;
}

describe("properties", () => {
  test("a written layout is accepted exactly when it is a format inside the grid", () => {
    const { doc, instance } = projectWith(layoutFor("large", 0, 0));
    const anyLayout = fc.record({
      x: fc.nat(14),
      y: fc.integer({ min: 385, max: 400 }),
      w: fc.integer({ min: 1, max: 13 }),
      h: fc.integer({ min: 1, max: 10 }),
    });
    fc.assert(
      fc.property(anyLayout, (layout) => {
        const verdict = validateProjectUpdate(doc, withLayout(doc, instance, layout), EDITOR);
        expect(verdict.ok).toBe(inGrid(layout) && isFormatLayout(layout));
      }),
      { numRuns: 150 },
    );
  });

  test("commands never produce a doc the server rejects, nor an overlap", () => {
    fc.assert(
      fc.property(fc.array(layoutOp, { maxLength: 25 }), (ops) => {
        const doc = createProjectDoc(META);
        const page = addPage(doc, { title: "T", kind: "dashboard", parentId: null });
        for (const op of ops) {
          const before = doc.fork();
          apply(doc, page.id, op);
          expect(validateProjectUpdate(before, doc, EDITOR)).toEqual({ ok: true });
          expect(overlapping(doc, page.id)).toBe(false);
        }
        expect(instancesSnapshotViolation(doc)).toBeNull();
      }),
      { numRuns: 60 },
    );
  });

  test("concurrent offline edits are all accepted by the server, overlaps included", () => {
    fc.assert(
      fc.property(
        fc.array(layoutOp, { maxLength: 8 }),
        fc.array(layoutOp, { maxLength: 8 }),
        fc.array(layoutOp, { maxLength: 8 }),
        (shared, mine, theirs) => {
          let server = createProjectDoc(META);
          const page = addPage(server, { title: "T", kind: "dashboard", parentId: null });
          for (const op of shared) apply(server, page.id, op);
          const clients = [mine, theirs].map((ops) => {
            const client = new LoroDoc();
            client.import(server.export({ mode: "update" }));
            for (const op of ops) apply(client, page.id, op);
            return client;
          });
          for (const client of clients) {
            const after = pushed(server, client);
            expect(validateProjectUpdate(server, after, EDITOR)).toEqual({ ok: true });
            server = after;
          }
          expect(instancesSnapshotViolation(server)).toBeNull();
          expect(listInstances(server, page.id).length).toBeGreaterThanOrEqual(
            Math.max(...clients.map((c) => listInstances(c, page.id).length)),
          );
        },
      ),
      { numRuns: 40 },
    );
  });
});
