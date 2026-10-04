import { expect, test } from "bun:test";
import { BUILTIN_IDS, sizeIssue, sizeLimitsOf } from "@kibo/schema";
import {
  AppWindow,
  Blocks,
  Box,
  FileText,
  Frame,
  Gamepad,
  LayoutDashboard,
  ListTree,
  Network,
  Plug,
  SquareKanban,
} from "lucide-react";
import { BUILTIN_COMPONENTS, componentIcon, componentRef, findComponent, pageIcon } from "./registry";

test("built-in components resolve by exact id@version", () => {
  expect(BUILTIN_COMPONENTS.map((c) => componentRef(c.manifest)).sort()).toEqual([
    "graph@1.0.0",
    "kanban@1.0.0",
    "mcp-source@1.0.0",
    "mockup@1.0.0",
    "notes@1.0.0",
    "snake@1.0.0",
    "tickets@1.0.0",
    "viewer-3d@1.0.0",
  ]);
  expect(findComponent("kanban@1.0.0")?.manifest.title).toBe("Kanban");
  expect(findComponent("kanban@2.0.0")).toBeUndefined();
  expect(findComponent("nope")).toBeUndefined();
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
  expect(pageIcon(view, [{ ...kanban, component: "tickets@1.0.0" }])).toBe(ListTree);
  expect(pageIcon(view, [{ ...kanban, component: "nope@1.0.0" }])).toBe(Blocks);
});

test("graph, notes, the MCP source and the snake are built-ins with their icons", () => {
  expect(BUILTIN_COMPONENTS.map((c) => c.manifest.id)).toEqual([
    "kanban",
    "tickets",
    "graph",
    "notes",
    "mcp-source",
    "viewer-3d",
    "snake",
    "mockup",
  ]);
  expect(componentIcon("mcp-source@1.0.0")).toBe(Plug);
  expect(componentIcon("viewer-3d@1.0.0")).toBe(Box);
  expect(componentIcon("snake@1.0.0")).toBe(Gamepad);
  expect(componentIcon("mockup@1.0.0")).toBe(Frame);
  expect(componentIcon("graph@1.0.0")).toBe(Network);
  expect(componentIcon("notes@1.0.0")).toBe(FileText);
  expect(BUILTIN_COMPONENTS.map((c) => c.manifest.id)).toEqual([...BUILTIN_IDS]);
});

test("every built-in declares a size minimum that fits its formats", () => {
  const minimums = Object.fromEntries(
    BUILTIN_COMPONENTS.map((c) => [c.manifest.id, sizeLimitsOf(c.manifest).min]),
  );
  expect(minimums).toEqual({
    kanban: { w: 6, h: 4 },
    tickets: { w: 4, h: 3 },
    graph: { w: 3, h: 3 },
    notes: { w: 4, h: 3 },
    "mcp-source": { w: 3, h: 2 },
    "viewer-3d": { w: 3, h: 3 },
    snake: { w: 3, h: 3 },
    mockup: { w: 3, h: 3 },
  });
  for (const c of BUILTIN_COMPONENTS) expect(sizeIssue(c.manifest)).toBeNull();
});
