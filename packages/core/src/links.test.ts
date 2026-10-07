import { describe, expect, test } from "bun:test";
import {
  addLink,
  createProjectDoc,
  createTicket,
  deleteTicket,
  listLinks,
  removeLink,
  setStatus,
  waitingOn,
} from "./index";

const setup = () => {
  const d = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
  });
  const [a, b, c] = ["A", "B", "C"].map((title) => createTicket(d, { title }));
  if (!a || !b || !c) throw new Error("setup");
  return { d, a, b, c };
};

describe("links", () => {
  test("an open blocker shows as 'waiting on' without changing the status", () => {
    const { d, a, b } = setup();
    addLink(d, { from: a.id, to: b.id, type: "blocks" });
    expect(waitingOn(d, b.id)).toEqual(["KIB-1"]);
    setStatus(d, a.id, "done");
    expect(waitingOn(d, b.id)).toEqual([]);
  });

  test("refuses self links, duplicates and blocking cycles", () => {
    const { d, a, b, c } = setup();
    expect(() => addLink(d, { from: a.id, to: a.id, type: "relates" })).toThrow("INVALID_INPUT");
    addLink(d, { from: a.id, to: b.id, type: "blocks" });
    addLink(d, { from: b.id, to: c.id, type: "blocks" });
    expect(() => addLink(d, { from: a.id, to: b.id, type: "blocks" })).toThrow("INVALID_INPUT");
    expect(() => addLink(d, { from: c.id, to: a.id, type: "blocks" })).toThrow("LINK_CYCLE");
    addLink(d, { from: c.id, to: a.id, type: "relates" });
    expect(() => addLink(d, { from: a.id, to: c.id, type: "relates" })).toThrow("INVALID_INPUT");
  });

  test("removing a link and deleting a ticket clean up edges", () => {
    const { d, a, b, c } = setup();
    const l = addLink(d, { from: a.id, to: b.id, type: "blocks" });
    addLink(d, { from: b.id, to: c.id, type: "relates" });
    removeLink(d, l.id);
    expect(() => removeLink(d, l.id)).toThrow("NOT_FOUND");
    deleteTicket(d, c.id);
    expect(listLinks(d)).toEqual([]);
  });
});
