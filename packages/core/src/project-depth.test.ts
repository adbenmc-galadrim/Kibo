import { describe, expect, test } from "bun:test";
import { LoroDoc, LoroMap, type LoroTreeNode } from "loro-crdt";
import { createProjectDoc, MAX_CONTAINER_DEPTH, MAX_TREE_DEPTH, projectDepthViolation } from "./index";

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: null,
  color: "#F97316",
  worktree: null,
  storybook: null,
};

function sharedCopy(build: (doc: LoroDoc) => void): LoroDoc {
  const source = createProjectDoc(meta);
  build(source);
  source.commit();
  const received = new LoroDoc();
  received.import(source.export({ mode: "update" }));
  return received;
}

function chain(doc: LoroDoc, length: number): LoroTreeNode {
  let node = doc.getTree("tickets").createNode();
  for (let i = 1; i < length; i++) node = node.createNode();
  return node;
}

describe("projectDepthViolation", () => {
  test("a full doc 1500 levels deep is refused", () => {
    const doc = sharedCopy((d) => chain(d, 1500));
    expect(projectDepthViolation(doc)).toContain(`${MAX_TREE_DEPTH}`);
  });

  test("a full doc nested too deep is refused", () => {
    const doc = sharedCopy((d) => {
      let map = d.getMap("extra");
      for (let i = 0; i < 5000; i++) map = map.setContainer("x", new LoroMap());
    });
    expect(projectDepthViolation(doc)).toContain(`${MAX_CONTAINER_DEPTH}`);
  });

  test("a full doc at both limits is accepted", () => {
    const doc = sharedCopy((d) => {
      let map = chain(d, MAX_TREE_DEPTH).data.setContainer("extra", new LoroMap());
      for (let i = 3; i < MAX_CONTAINER_DEPTH; i++) map = map.setContainer("x", new LoroMap());
      map.set("leaf", 1);
    });
    expect(projectDepthViolation(doc)).toBeNull();
  });

  test("an empty project is accepted", () => {
    expect(projectDepthViolation(createProjectDoc(meta))).toBeNull();
  });
});
