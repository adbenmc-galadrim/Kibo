import { expect, test } from "bun:test";
import type { Instance } from "@kibo/schema";
import { componentRef, findBuiltin } from "../registry";
import { manifestOf } from "./instance-capabilities";

const instanceOf = (component: string): Instance => ({
  id: "i1",
  pageId: "pg1",
  component,
  layout: { x: 0, y: 0, w: 4, h: 4 },
  config: {},
  componentHash: null,
});

test("a built-in takes its own manifest, any other ref grants nothing", () => {
  const kanban = findBuiltin("kanban");
  if (!kanban) throw new Error("kanban is a built-in");
  expect(manifestOf(instanceOf(componentRef(kanban.manifest)))).toBe(kanban.manifest);
  expect(manifestOf(instanceOf("pad@0.2.0"))).toBeNull();
  expect(manifestOf(instanceOf("notes@1.0.0"))).toBeNull();
});
