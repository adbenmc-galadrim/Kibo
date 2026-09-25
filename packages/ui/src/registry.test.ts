import { expect, test } from "bun:test";
import { AppWindow, Blocks, LayoutDashboard, ListTree, SquareKanban } from "lucide-react";
import { BUILTIN_COMPONENTS, componentRef, findComponent, pageIcon } from "./registry";

test("built-in components resolve by exact id@version", () => {
  expect(BUILTIN_COMPONENTS.map((c) => componentRef(c.manifest)).sort()).toEqual([
    "kanban@1.0.0",
    "tickets@1.0.0",
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
  };
  expect(pageIcon(dashboard, [])).toBe(LayoutDashboard);
  expect(pageIcon(view, [])).toBe(AppWindow);
  expect(pageIcon(view, [kanban])).toBe(SquareKanban);
  expect(pageIcon(view, [{ ...kanban, component: "tickets@1.0.0" }])).toBe(ListTree);
  expect(pageIcon(view, [{ ...kanban, component: "nope@1.0.0" }])).toBe(Blocks);
});
