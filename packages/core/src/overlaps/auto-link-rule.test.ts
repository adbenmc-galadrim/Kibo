import { describe, expect, test } from "bun:test";
import type { Overlap, WorkspaceRun } from "@kibo/schema";
import { indexOf } from "./arbitraries.test-helper";
import { autoLinkRule, type ImportProbe } from "./auto-link-rule";

const runs: { a: WorkspaceRun; b: WorkspaceRun } = {
  a: { key: "A", runId: "run-a", startedAt: 10 },
  b: { key: "B", runId: "run-b", startedAt: 20 },
};
const from = { workspace: "A", runId: "run-a" };
const to = { workspace: "B", runId: "run-b" };

const nothing: ImportProbe = () => null;
const resolvesTo =
  (path: string, added: boolean, exports: string[] = []): ImportProbe =>
  () => ({ path, added, exports });

const importer = indexOf("B", [
  { path: "src/pages/track.ts", texts: ['import { formatDate } from "../lib/format";', "formatDate(now);"] },
]);
const exporter = indexOf("A", [
  { path: "src/lib/format.ts", texts: ["export function formatDate(d: Date) {"] },
]);

const resolvedOverlap = (patch: Partial<Overlap> = {}): Overlap => ({
  id: "o1",
  projectId: "p",
  kind: "export",
  key: "export:formatDate",
  ownerRunId: "run-a",
  otherRunId: "run-b",
  ownerWorkspace: "A",
  otherWorkspace: "B",
  detail: {
    kind: "export",
    name: "formatDate",
    ownerPath: "src/lib/format.ts",
    otherPath: "src/utils/date.ts",
  },
  firstSeenAt: 1,
  lastSeenAt: 2,
  status: "resolved",
  deliveredAt: 1,
  ownerDeliveredAt: 1,
  resolvedAt: 2,
  ignoredBy: null,
  ignoredAt: null,
  ...patch,
});

describe("rule 1: import", () => {
  test("an import missing in B and added by A", () => {
    const probes = { a: resolvesTo("src/lib/format.ts", true, ["formatDate"]), b: nothing };
    expect(autoLinkRule(exporter, importer, probes, [], runs)).toEqual([
      { from, to, reason: "import", path: "src/lib/format.ts", name: "formatDate" },
    ]);
  });

  test("an import resolved in B links nothing", () => {
    const probes = {
      a: resolvesTo("src/lib/format.ts", true, ["formatDate"]),
      b: resolvesTo("src/lib/format.ts", true, ["formatDate"]),
    };
    expect(autoLinkRule(exporter, importer, probes, [], runs)).toEqual([]);
  });

  test("a module of B without the name that A added", () => {
    const a = indexOf("A", [
      { path: "src/lib/format.ts", status: "modified", texts: ["export function formatDate(d: Date) {"] },
    ]);
    const probes = {
      a: resolvesTo("src/lib/format.ts", false, ["formatDate"]),
      b: resolvesTo("src/lib/format.ts", false, ["other"]),
    };
    expect(autoLinkRule(a, importer, probes, [], runs)).toEqual([
      { from, to, reason: "import", path: "src/lib/format.ts", name: "formatDate" },
    ]);
  });

  test("a module of B that exports the name links nothing", () => {
    const probes = { a: nothing, b: resolvesTo("src/lib/format.ts", false, ["formatDate"]) };
    expect(autoLinkRule(exporter, importer, probes, [], runs)).toEqual([]);
  });

  test("an alias is never resolved", () => {
    const b = indexOf("B", [
      { path: "src/pages/track.ts", texts: ['import { formatDate } from "@/lib/format";'] },
    ]);
    const probes = { a: resolvesTo("src/lib/format.ts", true, ["formatDate"]), b: nothing };
    expect(autoLinkRule(exporter, b, probes, [], runs)).toEqual([]);
  });

  test("a module of the base in A links nothing", () => {
    const probes = { a: resolvesTo("src/lib/format.ts", false, ["formatDate"]), b: nothing };
    expect(autoLinkRule(exporter, importer, probes, [], runs)).toEqual([]);
  });

  test("only code files of B are read", () => {
    const b = indexOf("B", [{ path: "notes.md", texts: ['import { formatDate } from "../lib/format";'] }]);
    const probes = { a: resolvesTo("src/lib/format.ts", true, ["formatDate"]), b: nothing };
    expect(autoLinkRule(exporter, b, probes, [], runs)).toEqual([]);
  });
});

describe("rule 2: copy", () => {
  const copied = {
    path: "src/lib/format-date.ts",
    texts: ["export const formatDate = (d: Date) => d.toString();"],
  };
  const a = indexOf("A", [copied]);
  const b = indexOf("B", [copied]);
  const copy = { from, to, reason: "copy" as const, path: "src/lib/format-date.ts", name: null };

  test("a copy after a resolved overlap owned by A", () => {
    const later = { ...runs, a: { ...runs.a, startedAt: 30 } };
    expect(autoLinkRule(a, b, { a: nothing, b: nothing }, [resolvedOverlap()], later)).toEqual([copy]);
  });

  test("a resolved overlap owned by B links nothing from A", () => {
    const owned = resolvedOverlap({ ownerWorkspace: "B", otherWorkspace: "A" });
    expect(autoLinkRule(a, b, { a: nothing, b: nothing }, [owned], runs)).toEqual([]);
  });

  test("without an overlap the first started run wins", () => {
    expect(autoLinkRule(a, b, { a: nothing, b: nothing }, [], runs)).toEqual([copy]);
    const older = { ...runs, b: { ...runs.b, startedAt: 5 } };
    expect(autoLinkRule(a, b, { a: nothing, b: nothing }, [], older)).toEqual([]);
  });

  test("open or file overlaps do not count", () => {
    const later = { ...runs, a: { ...runs.a, startedAt: 30 } };
    const openOne = resolvedOverlap({ status: "open" });
    const fileOne = resolvedOverlap({ kind: "file", key: "file:x", detail: { kind: "file", path: "x" } });
    expect(autoLinkRule(a, b, { a: nothing, b: nothing }, [openOne, fileOne], later)).toEqual([]);
    expect(autoLinkRule(a, b, { a: nothing, b: nothing }, [openOne], runs)).toEqual([copy]);
  });

  test("different contents link nothing", () => {
    const other = indexOf("B", [{ path: copied.path, texts: ["export const formatDate = 2;"] }]);
    expect(autoLinkRule(a, other, { a: nothing, b: nothing }, [], runs)).toEqual([]);
  });

  test("a test file copy still links", () => {
    const test = { path: "src/a.test.ts", texts: ["expect(1).toBe(1);"] };
    expect(
      autoLinkRule(indexOf("A", [test]), indexOf("B", [test]), { a: nothing, b: nothing }, [], runs),
    ).toEqual([{ ...copy, path: "src/a.test.ts" }]);
  });
});

test("proposals are deduped by path and name", () => {
  const b = indexOf("B", [
    { path: "src/pages/track.ts", texts: ['import { formatDate } from "../lib/format";'] },
    { path: "src/pages/list.ts", texts: ['import { formatDate } from "../lib/format";'] },
  ]);
  const probes = { a: resolvesTo("src/lib/format.ts", true, ["formatDate"]), b: nothing };
  expect(autoLinkRule(exporter, b, probes, [], runs)).toHaveLength(1);
});
