import { expect, test } from "bun:test";
import type { Binding, Instance, Page } from "@kibo/schema";
import { linkedRepos } from "./linked-repos";

const binding = (id: string, repo: string): Binding => ({
  id,
  adapter: "github-issues",
  config: { repo, project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
});
const page = (id: string, title: string, kind: Page["kind"]): Page => ({ id, title, kind, parentId: null });
const instance = (id: string, pageId: string, bindingId: string): Instance => ({
  id,
  pageId,
  component: "kanban@1.0.0",
  layout: { x: 0, y: 0, w: 6, h: 4 },
  config: { source: { bindingId } },
  componentHash: null,
});

test("each bound repo is named after the view or widget that shows it", () => {
  const linked = linkedRepos({
    bindings: [binding("b1", "adam/kibo"), binding("b2", "adam/site"), binding("b3", "adam/orphan")],
    pages: [page("1@1", "Kanban GitHub", "view"), page("2@1", "Tableau de bord", "dashboard")],
    instances: [instance("i1", "1@1", "b1"), instance("i2", "2@1", "b2")],
  });
  expect(linked.get("adam/kibo")).toBe("Kanban GitHub");
  expect(linked.get("adam/site")).toBe("Kanban · Tableau de bord");
  expect(linked.get("adam/orphan")).toBe("GitHub Issues & Projects");
  expect(linked.get("adam/other")).toBeUndefined();
});

test("repos are matched without case", () => {
  const linked = linkedRepos({ bindings: [binding("b1", "Adam/Kibo")], pages: [], instances: [] });
  expect(linked.get("adam/kibo")).toBe("GitHub Issues & Projects");
});
