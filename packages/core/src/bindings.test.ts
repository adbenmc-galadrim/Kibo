import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import { addBinding, getBinding, listBindings, removeBinding } from "./bindings";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";

const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};

test("bindings are stored in the project doc and listed in the snapshot", () => {
  const d = createProjectDoc({
    id: "p",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#71717A",
    worktree: null,
  });
  addBinding(d, binding);
  expect(() => addBinding(d, binding)).toThrow("INVALID_INPUT");
  expect(getBinding(d, "b1").config.repo).toBe("adam/kibo");
  expect(readProject(d).bindings).toEqual([binding]);
  executeProjectCommand(d, { method: "addBinding", binding: { ...binding, id: "b2" } });
  expect(listBindings(d).map((b) => b.id)).toEqual(["b1", "b2"]);
  removeBinding(d, "b1");
  expect(() => getBinding(d, "b1")).toThrow("NOT_FOUND");
  expect(() => executeProjectCommand(d, { method: "removeBinding", bindingId: "b1" })).toThrow("NOT_FOUND");
});

test("an invalid binding never reaches the doc", () => {
  const d = createProjectDoc({
    id: "p",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#71717A",
    worktree: null,
  });
  expect(() => addBinding(d, { ...binding, config: { ...binding.config, repo: "nope" } })).toThrow();
  expect(listBindings(d)).toEqual([]);
});
