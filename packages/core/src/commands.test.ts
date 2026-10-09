import { describe, expect, test } from "bun:test";
import type { Page, Ticket } from "@kibo/schema";
import { createProjectDoc, executeProjectCommand, readProject } from "./index";

const doc = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
  });

describe("project commands", () => {
  test("builds a page with a kanban and a ticket, visible in the snapshot", () => {
    const d = doc();
    const page = executeProjectCommand(d, { method: "addPage", title: "Kanban", kind: "view" }) as Page;
    executeProjectCommand(d, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
    const a = executeProjectCommand(d, { method: "createTicket", title: "A" }) as Ticket;
    const b = executeProjectCommand(d, { method: "createTicket", title: "B", parentId: a.id }) as Ticket;
    executeProjectCommand(d, { method: "addLink", from: b.id, to: a.id, type: "relates" });
    const snap = readProject(d);
    expect(snap.meta.key).toBe("KIB");
    expect(snap.workflow).toHaveLength(6);
    expect(snap.instances).toMatchObject([
      { pageId: page.id, component: "kanban@1.0.0", layout: { x: 0, y: 0, w: 12, h: 6 } },
    ]);
    expect(snap.tickets.find((t) => t.id === a.id)).toMatchObject({
      progress: { done: 0, total: 1 },
      waitingOn: [],
    });
    expect(snap.links).toHaveLength(1);
  });

  test("a view page holds a single component", () => {
    const d = doc();
    const page = executeProjectCommand(d, { method: "addPage", title: "Kanban", kind: "view" }) as Page;
    executeProjectCommand(d, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
    expect(() =>
      executeProjectCommand(d, { method: "addInstance", pageId: page.id, component: "tickets@1.0.0" }),
    ).toThrow("INVALID_INPUT");
  });

  test("deleting a page removes the instances of the page and of its sub-pages", () => {
    const d = doc();
    const board = executeProjectCommand(d, { method: "addPage", title: "Board", kind: "dashboard" }) as Page;
    const sub = executeProjectCommand(d, {
      method: "addPage",
      title: "Sub",
      kind: "view",
      parentId: board.id,
    }) as Page;
    executeProjectCommand(d, { method: "addInstance", pageId: board.id, component: "tickets@1.0.0" });
    executeProjectCommand(d, { method: "addInstance", pageId: sub.id, component: "kanban@1.0.0" });
    executeProjectCommand(d, { method: "deletePage", pageId: board.id });
    expect(readProject(d).instances).toEqual([]);
  });

  test("an instance needs an existing page", () => {
    expect(() =>
      executeProjectCommand(doc(), { method: "addInstance", pageId: "9@9", component: "kanban@1.0.0" }),
    ).toThrow("NOT_FOUND");
  });
});
