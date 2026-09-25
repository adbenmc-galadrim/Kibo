import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  createProjectDoc,
  createWorkspaceDoc,
  getProjectMeta,
  getWorkflow,
  listProjects,
  nextTicketSeq,
  registerProject,
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
});
