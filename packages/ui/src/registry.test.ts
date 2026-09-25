import { expect, test } from "bun:test";
import { BUILTIN_COMPONENTS, componentRef, findComponent } from "./registry";

test("built-in components resolve by exact id@version", () => {
  expect(BUILTIN_COMPONENTS.map((c) => componentRef(c.manifest)).sort()).toEqual([
    "kanban@1.0.0",
    "tickets@1.0.0",
  ]);
  expect(findComponent("kanban@1.0.0")?.manifest.title).toBe("Kanban");
  expect(findComponent("kanban@2.0.0")).toBeUndefined();
  expect(findComponent("nope")).toBeUndefined();
});
