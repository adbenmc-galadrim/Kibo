import { describe, expect, test } from "bun:test";
import { addInstance, addPage, createProjectDoc, getInstance, setInstanceComponent } from "./index";

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: null,
  color: "#F97316",
  worktree: null,
  storybook: null,
};
const HASH = "a".repeat(64);

describe("componentHash", () => {
  test("addInstance records the given hash, null by default", () => {
    const doc = createProjectDoc(meta);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const custom = addInstance(doc, { pageId: page.id, component: "burndown@0.1.0", componentHash: HASH });
    const builtin = addInstance(doc, { pageId: page.id, component: "kanban@1.0.0" });
    expect(getInstance(doc, custom.id).componentHash).toBe(HASH);
    expect(getInstance(doc, builtin.id).componentHash).toBeNull();
  });

  test("setInstanceComponent replaces the hash with the new version's", () => {
    const doc = createProjectDoc(meta);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const inst = addInstance(doc, { pageId: page.id, component: "burndown@0.1.0", componentHash: HASH });
    setInstanceComponent(doc, { instanceId: inst.id, component: "burndown@0.2.0", config: {}, data: null });
    expect(getInstance(doc, inst.id).componentHash).toBeNull();
    setInstanceComponent(doc, {
      instanceId: inst.id,
      component: "burndown@0.3.0",
      config: {},
      data: null,
      componentHash: "b".repeat(64),
    });
    expect(getInstance(doc, inst.id).componentHash).toBe("b".repeat(64));
  });

  test("a malformed hash is refused", () => {
    const doc = createProjectDoc(meta);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    expect(() =>
      addInstance(doc, { pageId: page.id, component: "burndown@0.1.0", componentHash: "xyz" }),
    ).toThrow("INVALID_INPUT");
  });
});
