import { expect, test } from "bun:test";
import { isBuiltinId, sizeIssue, sizeLimitsOf } from "@kibo/schema";
import {
  AppWindow,
  Blocks,
  CalendarRange,
  Frame,
  LayoutDashboard,
  MessageCircleQuestion,
  Network,
  SquareKanban,
} from "lucide-react";
import { BUILTIN_COMPONENTS, componentIcon, componentRef, findComponent, pageIcon } from "./registry";

test("built-in components resolve by exact id@version", () => {
  expect(BUILTIN_COMPONENTS.map((c) => componentRef(c.manifest)).sort()).toEqual([
    "graph@1.0.0",
    "kanban@1.0.0",
    "mockup@1.0.0",
    "overview@1.0.0",
    "planning@1.0.0",
    "questions@1.0.0",
  ]);
  expect(findComponent("kanban@1.0.0")?.manifest.title).toBe("Kanban");
  expect(findComponent("kanban@2.0.0")).toBeUndefined();
  expect(findComponent("nope")).toBeUndefined();
});

test("retired components no longer resolve and fall back to the generic icon", () => {
  for (const ref of [
    "itch@1.0.0",
    "snake@1.0.0",
    "notes@1.0.0",
    "tickets@1.0.0",
    "github-issues@1.0.0",
    "mcp-source@1.0.0",
    "viewer-3d@1.0.0",
  ]) {
    expect(findComponent(ref)).toBeUndefined();
    expect(componentIcon(ref)).toBe(Blocks);
  }
});

test("a page shows the icon of its kind, or of the component a view holds", () => {
  const view = { id: "v", title: "Board", kind: "view", parentId: null } as const;
  const dashboard = { ...view, id: "d", kind: "dashboard" } as const;
  const kanban = {
    id: "i",
    pageId: "v",
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 6 },
    config: {},
    componentHash: null,
  };
  expect(pageIcon(dashboard, [])).toBe(LayoutDashboard);
  expect(pageIcon(view, [])).toBe(AppWindow);
  expect(pageIcon(view, [kanban])).toBe(SquareKanban);
  expect(pageIcon(view, [{ ...kanban, component: "tickets@1.0.0" }])).toBe(Blocks);
  expect(pageIcon(view, [{ ...kanban, component: "questions@1.0.0" }])).toBe(MessageCircleQuestion);
  expect(pageIcon(view, [{ ...kanban, component: "nope@1.0.0" }])).toBe(Blocks);
});

test("the six built-ins come with their icons", () => {
  expect(BUILTIN_COMPONENTS.map((c) => c.manifest.id)).toEqual([
    "kanban",
    "graph",
    "mockup",
    "questions",
    "planning",
    "overview",
  ]);
  expect(componentIcon("mockup@1.0.0")).toBe(Frame);
  expect(componentIcon("graph@1.0.0")).toBe(Network);
  expect(componentIcon("questions@1.0.0")).toBe(MessageCircleQuestion);
  expect(componentIcon("planning@1.0.0")).toBe(CalendarRange);
  expect(componentIcon("overview@1.0.0")).toBe(LayoutDashboard);
  for (const c of BUILTIN_COMPONENTS) expect(isBuiltinId(c.manifest.id)).toBe(true);
});

test("every built-in declares a size minimum that fits its formats", () => {
  const minimums = Object.fromEntries(
    BUILTIN_COMPONENTS.map((c) => [c.manifest.id, sizeLimitsOf(c.manifest).min]),
  );
  expect(minimums).toEqual({
    kanban: { w: 6, h: 4 },
    graph: { w: 3, h: 3 },
    mockup: { w: 3, h: 3 },
    questions: { w: 4, h: 3 },
    planning: { w: 6, h: 4 },
    overview: { w: 6, h: 6 },
  });
  for (const c of BUILTIN_COMPONENTS) expect(sizeIssue(c.manifest)).toBeNull();
});
