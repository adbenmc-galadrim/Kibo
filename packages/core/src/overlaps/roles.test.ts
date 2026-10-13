import { describe, expect, test } from "bun:test";
import type { WorkspaceRun } from "@kibo/schema";
import type { Candidate } from "./compare";
import { assignRoles } from "./roles";

const a: WorkspaceRun = { key: "wsA", runId: "r-a", startedAt: 100 };
const b: WorkspaceRun = { key: "wsB", runId: "r-b", startedAt: 50 };

const exportCandidate: Candidate = {
  kind: "export",
  key: "export:formatDate",
  a: { path: "src/a.ts", start: null },
  b: { path: "src/b.ts", start: null },
  name: "formatDate",
  lines: null,
  chars: null,
};

const blockCandidate: Candidate = {
  kind: "block",
  key: "block:abc",
  a: { path: "src/a.ts", start: 40 },
  b: { path: "src/b.ts", start: 12 },
  name: null,
  lines: 14,
  chars: 400,
};

describe("assignRoles", () => {
  test("the writer is other", () => {
    expect(assignRoles(exportCandidate, a, b, "wsB")).toEqual({
      kind: "export",
      key: "export:formatDate",
      ownerWorkspace: "wsA",
      otherWorkspace: "wsB",
      ownerRunId: "r-a",
      otherRunId: "r-b",
      detail: { kind: "export", name: "formatDate", ownerPath: "src/a.ts", otherPath: "src/b.ts" },
    });
  });

  test("without a writer the first started run is owner", () => {
    const found = assignRoles(exportCandidate, a, b, null);
    expect([found.ownerRunId, found.otherRunId]).toEqual(["r-b", "r-a"]);
    expect(found.detail).toEqual({
      kind: "export",
      name: "formatDate",
      ownerPath: "src/b.ts",
      otherPath: "src/a.ts",
    });
  });

  test("the run id breaks a start tie", () => {
    const tied = { ...b, startedAt: 100, runId: "r-0" };
    expect(assignRoles(exportCandidate, a, tied, null).ownerRunId).toBe("r-0");
    expect(assignRoles(exportCandidate, { ...a, runId: "r-00" }, tied, null).ownerRunId).toBe("r-0");
  });

  test("a writer outside the pair falls back to the start order", () => {
    expect(assignRoles(exportCandidate, a, b, "wsC").ownerRunId).toBe("r-b");
  });

  test("block starts follow the roles", () => {
    expect(assignRoles(blockCandidate, a, b, "wsA").detail).toEqual({
      kind: "block",
      ownerPath: "src/b.ts",
      ownerStart: 12,
      otherPath: "src/a.ts",
      otherStart: 40,
      lines: 14,
      chars: 400,
    });
  });

  test("a file overlap keeps its path", () => {
    const file: Candidate = { ...exportCandidate, kind: "file", key: "file:src/a.ts", b: exportCandidate.a };
    expect(assignRoles(file, a, b, null).detail).toEqual({ kind: "file", path: "src/a.ts" });
  });
});
