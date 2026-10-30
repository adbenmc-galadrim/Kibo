import { expect, test } from "bun:test";
import { Instance } from "./index";

test("a v0.6 instance parses with componentHash null", () => {
  const parsed = Instance.parse({
    id: "i1",
    pageId: "pg1",
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  });
  expect(parsed.componentHash).toBeNull();
});

test("componentHash must be a sha256 when present", () => {
  const base = {
    id: "i1",
    pageId: "pg1",
    component: "burndown@0.3.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  };
  expect(Instance.safeParse({ ...base, componentHash: "d".repeat(64) }).success).toBe(true);
  expect(Instance.safeParse({ ...base, componentHash: "nope" }).success).toBe(false);
});
