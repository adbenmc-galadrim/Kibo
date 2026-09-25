import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
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
  setStatus,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: "/tmp/kibo", color: "#F97316" };

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
