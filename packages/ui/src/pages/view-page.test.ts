import { expect, test } from "bun:test";
import type { Instance, Page } from "@kibo/schema";
import { viewPageFor } from "./view-page";

const page = (id: string, kind: Page["kind"]): Page => ({ id, title: id, kind, parentId: null });
const instance = (pageId: string, component: string): Instance => ({
  id: `${pageId}-${component}`,
  pageId,
  component,
  layout: { x: 0, y: 0, w: 1, h: 1 },
  config: {},
});

test("finds the first view page showing the component", () => {
  const project = {
    pages: [page("1@1", "dashboard"), page("2@1", "view"), page("3@1", "view"), page("4@1", "view")],
    instances: [
      instance("1@1", "graph@1.0.0"),
      instance("2@1", "kanban@1.0.0"),
      instance("3@1", "graph@1.0.0"),
      instance("4@1", "graph@2.0.0"),
    ],
  };
  expect(viewPageFor(project, "graph")?.id).toBe("3@1");
  expect(viewPageFor(project, "notes")).toBeNull();
});
