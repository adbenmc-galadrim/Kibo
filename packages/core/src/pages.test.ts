import { describe, expect, test } from "bun:test";
import { addPage, createProjectDoc, deletePage, listPages, movePage, renamePage } from "./index";

const doc = () => createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });

describe("pages", () => {
  test("adds nested pages and lists them depth-first", () => {
    const d = doc();
    const board = addPage(d, { title: "Tableau de bord", kind: "dashboard" });
    addPage(d, { title: "Kanban", kind: "view" });
    addPage(d, { title: "Sprint", kind: "view", parentId: board.id });
    expect(listPages(d).map((p) => p.title)).toEqual(["Tableau de bord", "Sprint", "Kanban"]);
    expect(listPages(d)[1]?.parentId).toBe(board.id);
  });

  test("renames and rejects an empty title", () => {
    const d = doc();
    const p = addPage(d, { title: "Notes", kind: "view" });
    renamePage(d, p.id, "Décisions");
    expect(listPages(d)[0]?.title).toBe("Décisions");
    expect(() => renamePage(d, p.id, "  ")).toThrow("INVALID_INPUT");
  });

  test("refuses to move a page under its own descendant and leaves the tree unchanged", () => {
    const d = doc();
    const a = addPage(d, { title: "A", kind: "dashboard" });
    const b = addPage(d, { title: "B", kind: "view", parentId: a.id });
    expect(() => movePage(d, a.id, b.id)).toThrow("TREE_CYCLE");
    expect(listPages(d).find((p) => p.id === b.id)?.parentId).toBe(a.id);
    expect(listPages(d).find((p) => p.id === a.id)?.parentId).toBeNull();
  });

  test("deleting a page deletes its descendants", () => {
    const d = doc();
    const a = addPage(d, { title: "A", kind: "dashboard" });
    const b = addPage(d, { title: "B", kind: "view", parentId: a.id });
    expect(deletePage(d, a.id).sort()).toEqual([a.id, b.id].sort());
    expect(listPages(d)).toEqual([]);
  });
});
