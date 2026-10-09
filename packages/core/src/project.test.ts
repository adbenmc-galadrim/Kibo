import { describe, expect, test } from "bun:test";
import { LoroDoc, LoroMap } from "loro-crdt";
import {
  countTicketsByStatus,
  createProjectDoc,
  createTicket,
  createWorkspaceDoc,
  executeProjectCommand,
  getProjectMeta,
  getWorkflow,
  listProjects,
  nextTicketSeq,
  peekTicketKey,
  readProject,
  registerProject,
  setProjectMeta,
  setStatus,
  unregisterProject,
  updateRegisteredProject,
} from "./index";

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/tmp/kibo",
  color: "#F97316",
  worktree: null,
  storybook: null,
};

describe("workspace", () => {
  test("registers projects in order", () => {
    const ws = createWorkspaceDoc();
    registerProject(ws, meta);
    registerProject(ws, { ...meta, id: "p2", key: "FAC", name: "API Facturation" });
    expect(listProjects(ws).map((p) => p.key)).toEqual(["KIB", "FAC"]);
  });
  test("refuses a duplicate project key", () => {
    const ws = createWorkspaceDoc();
    registerProject(ws, meta);
    expect(() => registerProject(ws, { ...meta, id: "p3" })).toThrow("INVALID_INPUT");
  });
  test("a registered project is updated in place and can be removed", () => {
    const ws = createWorkspaceDoc();
    registerProject(ws, meta);
    registerProject(ws, { ...meta, id: "p2", key: "FAC", name: "API Facturation" });
    expect(updateRegisteredProject(ws, "p1", { name: "Kibo 2", folder: null })).toEqual({
      ...meta,
      name: "Kibo 2",
      folder: null,
    });
    expect(listProjects(ws).map((p) => [p.id, p.name, p.folder])).toEqual([
      ["p1", "Kibo 2", null],
      ["p2", "API Facturation", "/tmp/kibo"],
    ]);
    expect(() => updateRegisteredProject(ws, "p1", {})).toThrow("empty patch");
    expect(() => updateRegisteredProject(ws, "p9", { name: "x" })).toThrow("NOT_FOUND");
    unregisterProject(ws, "p1");
    expect(listProjects(ws).map((p) => p.id)).toEqual(["p2"]);
    expect(() => unregisterProject(ws, "p1")).toThrow("NOT_FOUND");
    registerProject(ws, meta);
    expect(listProjects(ws).map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});

describe("project meta", () => {
  test("setProjectMeta writes only the given fields and keeps key and id", () => {
    const doc = createProjectDoc(meta);
    expect(setProjectMeta(doc, { color: "#6366F1" })).toEqual({ ...meta, color: "#6366F1" });
    expect(setProjectMeta(doc, { name: "Noyau", folder: null })).toEqual({
      ...meta,
      name: "Noyau",
      color: "#6366F1",
      folder: null,
    });
    expect(() => setProjectMeta(doc, { name: " " })).toThrow("INVALID_INPUT");
    expect(getProjectMeta(doc).key).toBe("KIB");
  });
});

describe("project", () => {
  test("starts with meta and the default workflow", () => {
    const doc = createProjectDoc(meta);
    expect(getProjectMeta(doc)).toEqual(meta);
    expect(getWorkflow(doc).map((s) => s.id)).toContain("blocked");
  });
  test("ticket sequence survives a snapshot round-trip", () => {
    const doc = createProjectDoc(meta);
    expect(nextTicketSeq(doc)).toBe(1);
    expect(nextTicketSeq(doc)).toBe(2);
    const copy = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
    expect(nextTicketSeq(copy)).toBe(3);
  });
  test("peeks the next ticket key without consuming it", () => {
    const doc = createProjectDoc(meta);
    expect(peekTicketKey(doc)).toBe("KIB-1");
    expect(peekTicketKey(doc)).toBe("KIB-1");
    expect(readProject(doc).nextTicketKey).toBe("KIB-1");
    executeProjectCommand(doc, { method: "createTicket", title: "A" });
    expect(readProject(doc).nextTicketKey).toBe("KIB-2");
  });
  test("counts tickets by status, sub-tickets included", () => {
    const doc = createProjectDoc(meta);
    const a = createTicket(doc, { title: "A", statusId: "in_progress" });
    createTicket(doc, { title: "B", parentId: a.id, statusId: "done" });
    const c = createTicket(doc, { title: "C" });
    setStatus(doc, c.id, "blocked", "waiting");
    expect(countTicketsByStatus(doc)).toEqual({
      backlog: 0,
      todo: 0,
      in_progress: 1,
      in_review: 0,
      blocked: 1,
      done: 1,
    });
  });
});

test("local worktree settings never reach the project doc nor the workspace", () => {
  const local = {
    ...meta,
    worktree: { baseRef: "origin/dev", pathTemplate: "../kibo-{slug}", setup: "make wt" },
  };
  const ws = createWorkspaceDoc();
  registerProject(ws, local);
  const doc = createProjectDoc(local);
  expect(doc.getMap("meta").get("worktree")).toBeUndefined();
  expect(JSON.stringify(ws.toJSON())).not.toContain("make wt");
  expect(getProjectMeta(doc).worktree).toBeNull();
  expect(listProjects(ws)[0]?.worktree).toBeNull();
});

test("a worktree patch is never written to the workspace nor the project doc", () => {
  const worktree = { baseRef: "origin/dev", pathTemplate: "../kibo-{slug}", setup: "make wt" };
  const ws = createWorkspaceDoc();
  registerProject(ws, meta);
  const doc = createProjectDoc(meta);
  const patch = { name: "Kibo 2", worktree };
  updateRegisteredProject(ws, "p1", patch);
  setProjectMeta(doc, patch);
  const entry = ws.getList("projects").get(0);
  expect(entry instanceof LoroMap ? entry.get("worktree") : "not a map").toBeUndefined();
  expect(doc.getMap("meta").get("worktree")).toBeUndefined();
  expect(JSON.stringify(ws.toJSON())).not.toContain("make wt");
  expect(JSON.stringify(doc.toJSON())).not.toContain("make wt");
  expect(getProjectMeta(doc).name).toBe("Kibo 2");
});

test("local storybook settings never reach the project doc nor the workspace", () => {
  const local = { ...meta, storybook: { origin: "https://sb.example.com", portEnv: "SB_PORT" } };
  const ws = createWorkspaceDoc();
  registerProject(ws, local);
  const doc = createProjectDoc(local);
  expect(doc.getMap("meta").get("storybook")).toBeUndefined();
  expect(JSON.stringify(ws.toJSON())).not.toContain("sb.example.com");
  expect(getProjectMeta(doc).storybook).toBeNull();
  expect(listProjects(ws)[0]?.storybook).toBeNull();
});
