import { describe, expect, test } from "bun:test";
import type { IndexedFile, WorkspaceIndex, WorkspaceRun } from "@kibo/schema";
import fc from "fast-check";
import { fileOf } from "./arbitraries.test-helper";
import { autoLinkRule, type ImportProbe } from "./auto-link-rule";
import { resolveRelative } from "./imports";

const MODULES = ["src/lib/format.ts", "src/pages/util.ts", "src/lib/index.ts", "src/copy.ts"];
const NAMES = ["formatDate", "parseDate", "HttpClient"];
const SPECS = ["../lib/format", "./util", "../lib", "@/lib/format", "../copy", "react"];

const arbModule = fc.record({
  path: fc.constantFrom(...MODULES),
  status: fc.constantFrom<IndexedFile["status"]>("added", "modified"),
  names: fc.subarray(NAMES),
  body: fc.constantFrom("one", "two"),
});

const arbImporter = fc.record({
  spec: fc.constantFrom(...SPECS),
  names: fc.subarray(NAMES),
});

const arbIndex = (key: string) =>
  fc
    .record({
      modules: fc.uniqueArray(arbModule, { maxLength: 4, selector: (m) => m.path }),
      importers: fc.array(arbImporter, { maxLength: 4 }),
    })
    .map(
      ({ modules, importers }): WorkspaceIndex => ({
        key,
        runIds: [`run-${key}`],
        baseHead: "base",
        truncated: false,
        partial: false,
        at: 0,
        files: [
          ...modules.map((m) =>
            fileOf({
              path: m.path,
              status: m.status,
              texts: [m.body, ...m.names.map((n) => `export const ${n} = 1;`)],
            }),
          ),
          ...importers.map((imp, i) =>
            fileOf({
              path: `src/pages/page${i}.ts`,
              texts: [`import { ${imp.names.join(", ")} } from "${imp.spec}";`],
            }),
          ),
        ],
      }),
    );

const probeOf =
  (index: WorkspaceIndex): ImportProbe =>
  (fromPath, spec) => {
    const files = new Map(index.files.map((f) => [f.path, f]));
    const path = resolveRelative(fromPath, spec, (p) => files.has(p));
    const file = path === null ? undefined : files.get(path);
    return file ? { path: file.path, added: file.status === "added", exports: file.exports } : null;
  };

const arbRuns = fc.tuple(fc.nat(100), fc.nat(100)).map(([a, b]): { a: WorkspaceRun; b: WorkspaceRun } => ({
  a: { key: "A", runId: "run-A", startedAt: a },
  b: { key: "B", runId: "run-B", startedAt: b },
}));

const probesOf = (a: WorkspaceIndex, b: WorkspaceIndex) => ({ a: probeOf(a), b: probeOf(b) });

describe("autoLinkRule properties", () => {
  test("(f) a workspace never links with itself", () => {
    fc.assert(
      fc.property(arbIndex("A"), arbRuns, (a, runs) => {
        expect(autoLinkRule(a, a, probesOf(a, a), [], { a: runs.a, b: runs.a })).toEqual([]);
      }),
    );
  });

  test("(f) an import resolved in B never links", () => {
    const everything: ImportProbe = (_from, spec) => ({ path: spec, added: true, exports: NAMES });
    fc.assert(
      fc.property(arbIndex("A"), arbIndex("B"), arbRuns, (a, b, runs) => {
        const found = autoLinkRule(a, b, { a: probeOf(a), b: everything }, [], runs);
        expect(found.filter((p) => p.reason === "import")).toEqual([]);
      }),
    );
  });

  test("(f) every proposal points from A to B at code that A added", () => {
    fc.assert(
      fc.property(arbIndex("A"), arbIndex("B"), arbRuns, (a, b, runs) => {
        for (const proposal of autoLinkRule(a, b, probesOf(a, b), [], runs)) {
          expect([proposal.from.workspace, proposal.to.workspace]).toEqual(["A", "B"]);
          const file = a.files.find((f) => f.path === proposal.path);
          expect(file).toBeDefined();
          const addedName = proposal.name !== null && file?.exports.includes(proposal.name) === true;
          expect(file?.status === "added" || (proposal.reason === "import" && addedName)).toBe(true);
        }
      }),
    );
  });
});
