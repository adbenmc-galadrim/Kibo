import { describe, expect, test } from "bun:test";
import { DEFAULT_DUPLICATION_SETTINGS, DUPLICATION_SHARED_GLOBS, EMPTY_DELIVERY } from "@kibo/schema";
import { LoroDoc, LoroMap } from "loro-crdt";
import {
  countTicketsByStatus,
  createProjectDoc,
  createTicket,
  createWorkspaceDoc,
  effectiveDuplication,
  executeProjectCommand,
  getProjectMeta,
  getWorkflow,
  LOCAL_ONLY_META,
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
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
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

  test("setProjectMeta writes the open limit, which survives a snapshot and can be cleared", () => {
    const doc = createProjectDoc(meta);
    expect(setProjectMeta(doc, { tracking: { openLimit: 3 } }).tracking).toEqual({ openLimit: 3 });
    const copy = new LoroDoc();
    copy.import(doc.export({ mode: "snapshot" }));
    expect(getProjectMeta(copy).tracking).toEqual({ openLimit: 3 });
    expect(() => setProjectMeta(doc, { tracking: { openLimit: 11 } })).toThrow("INVALID_INPUT");
    expect(setProjectMeta(doc, { tracking: null }).tracking).toBeNull();
  });

  test("setProjectMeta writes the description, which survives a snapshot and can be cleared", () => {
    const doc = createProjectDoc(meta);
    const description = "Application terrain des contrôleurs";
    expect(setProjectMeta(doc, { description }).description).toBe(description);
    const copy = new LoroDoc();
    copy.import(doc.export({ mode: "snapshot" }));
    expect(getProjectMeta(copy).description).toBe(description);
    expect(() => setProjectMeta(doc, { description: "x".repeat(201) })).toThrow("INVALID_INPUT");
    expect(setProjectMeta(doc, { description: null }).description).toBeNull();
  });
});

describe("project", () => {
  test("starts with meta and the default workflow", () => {
    const doc = createProjectDoc(meta);
    expect(getProjectMeta(doc)).toEqual(meta);
    expect(getWorkflow(doc).map((s) => s.id)).toContain("blocked");
  });

  test("reads the description the project was created with", () => {
    const doc = createProjectDoc({ ...meta, description: "Suivi de chantier" });
    expect(getProjectMeta(doc).description).toBe("Suivi de chantier");
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
    expect(readProject(doc, "2026-10-16").nextTicketKey).toBe("KIB-1");
    executeProjectCommand(doc, { method: "createTicket", title: "A" });
    expect(readProject(doc, "2026-10-16").nextTicketKey).toBe("KIB-2");
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
    worktree: { baseRef: "origin/dev", pathTemplate: "../kibo-{slug}", setup: "make wt", recipe: null },
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
  const worktree = { baseRef: "origin/dev", pathTemplate: "../kibo-{slug}", setup: "make wt", recipe: null };
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

test("local duplication settings never reach the project doc nor the workspace", () => {
  const duplication = { ...DEFAULT_DUPLICATION_SETTINGS, ignore: ["src/generated-zz/**"] };
  const local = { ...meta, duplication };
  const ws = createWorkspaceDoc();
  registerProject(ws, local);
  const doc = createProjectDoc(local);
  expect(LOCAL_ONLY_META.has("duplication")).toBe(true);
  expect(doc.getMap("meta").get("duplication")).toBeUndefined();
  expect(JSON.stringify(ws.toJSON())).not.toContain("generated-zz");
  expect(getProjectMeta(doc).duplication).toBeNull();
  expect(listProjects(ws)[0]?.duplication).toBeNull();
});

test("the effective duplication settings fall back to the defaults", () => {
  expect(effectiveDuplication({ duplication: null })).toEqual({
    ...DEFAULT_DUPLICATION_SETTINGS,
    shared: [...DUPLICATION_SHARED_GLOBS],
  });
  const own = { ...DEFAULT_DUPLICATION_SETTINGS, minLines: 12, shared: [] };
  expect(effectiveDuplication({ duplication: own })).toBe(own);
});

test("a duplication row stored before shared files gets the default shared files", () => {
  const { shared: _shared, ...old } = DEFAULT_DUPLICATION_SETTINGS;
  expect(effectiveDuplication({ duplication: { ...old, minLines: 12 } })).toEqual({
    ...old,
    minLines: 12,
    shared: [...DUPLICATION_SHARED_GLOBS],
  });
  expect(effectiveDuplication({ duplication: { ...old, shared: [] } }).shared).toEqual([]);
});

test("local delivery settings never reach the project doc nor the workspace", () => {
  const delivery = { ...EMPTY_DELIVERY, root: "/Users/a/Documents/emis-zz" };
  const local = { ...meta, delivery };
  const ws = createWorkspaceDoc();
  registerProject(ws, local);
  const doc = createProjectDoc(local);
  expect(LOCAL_ONLY_META.has("delivery")).toBe(true);
  expect(doc.getMap("meta").get("delivery")).toBeUndefined();
  expect(JSON.stringify(ws.toJSON())).not.toContain("emis-zz");
  expect(getProjectMeta(doc).delivery).toBeNull();
  expect(listProjects(ws)[0]?.delivery).toBeNull();
});
