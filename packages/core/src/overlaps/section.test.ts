import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  MASKED,
  type Overlap,
  type ParallelRun,
  type ParallelWork,
  WORK_SECTION_FOOTER,
  WORK_SECTION_OVERLAPS,
  WORK_SECTION_TITLE,
} from "@kibo/schema";
import { composeWorkSection, sectionFingerprint } from "./section";

const NOW = 1_000_000_000;
const MIN = 60_000;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

const run = (over: Partial<ParallelRun> = {}): ParallelRun => ({
  runId: "r12",
  name: "bou · livraison · BOU-12",
  ticketKey: "BOU-12",
  ticketTitle: "Format des dates de livraison",
  startedAt: NOW - 12 * MIN,
  step: "Écrire les tests",
  plan: [
    { id: "a", title: "Lire le code", status: "done", note: null },
    { id: "b", title: "Écrire les tests", status: "doing", note: null },
  ],
  files: [
    { path: "src/lib/format.ts", status: "added", added: 42, removed: 0 },
    { path: "src/i18n/fr.ts", status: "modified", added: 3, removed: 1 },
  ],
  exports: [{ name: "formatDate", path: "src/lib/format.ts" }],
  workspace: "worktree",
  worktreeName: "bou-12",
  truncated: false,
  ...over,
});

const work = (over: Partial<ParallelWork> = {}): ParallelWork => ({
  runs: [run()],
  more: 0,
  overlaps: [],
  partial: false,
  ...over,
});

const overlap = (over: Partial<Overlap> = {}): Overlap => ({
  id: "o1",
  projectId: "p",
  kind: "export",
  key: "formatDate",
  ownerRunId: "r12",
  otherRunId: "r15",
  ownerWorkspace: "/w/bou-12",
  otherWorkspace: "/w/bou-15",
  detail: {
    kind: "export",
    name: "formatDate",
    ownerPath: "src/lib/format.ts",
    otherPath: "src/utils/date.ts",
  },
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  status: "open",
  deliveredAt: null,
  ownerDeliveredAt: null,
  resolvedAt: null,
  ignoredBy: null,
  ignoredAt: null,
  ...over,
});

const many = <T>(n: number, make: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => make(i));

describe("composeWorkSection", () => {
  test("no other run gives no section", () => {
    expect(composeWorkSection(work({ runs: [] }), NOW)).toBeNull();
  });

  test("one run is described with its plan, files, exports and workspace", () => {
    const text = composeWorkSection(work(), NOW) ?? "";
    expect(text.startsWith(`${WORK_SECTION_TITLE}\n`)).toBe(true);
    expect(text).toContain("### bou · livraison · BOU-12 · Format des dates de livraison");
    expect(text).toContain("- démarré il y a 12 min · étape : Écrire les tests");
    expect(text).toContain("  1. [done] Lire le code\n  2. [doing] Écrire les tests");
    expect(text).toContain(
      "- Fichiers créés ou modifiés :\n  - `src/i18n/fr.ts` (+3 −1)\n  - `src/lib/format.ts` (+42 −0)",
    );
    expect(text).toContain("- Exports nouveaux :\n  - `formatDate` (`src/lib/format.ts`)");
    expect(text).toContain("- Espace : worktree `bou-12`");
    expect(text.endsWith(WORK_SECTION_FOOTER)).toBe(true);
  });

  test("each workspace kind has its own wording", () => {
    const of = (workspace: ParallelRun["workspace"]) =>
      composeWorkSection(work({ runs: [run({ workspace, worktreeName: null })] }), NOW) ?? "";
    expect(of("repo")).toContain("- Espace : dossier du projet");
    expect(of("shared")).toContain("- Espace : dossier du projet, partagé avec toi");
    expect(of("isolated")).toContain("- Espace : dossier isolé, non comparé");
  });

  test("a run without a plan says so and durations are rounded", () => {
    const text =
      composeWorkSection(
        work({ runs: [run({ plan: null, step: null, startedAt: NOW - 3 * 60 * MIN })] }),
        NOW,
      ) ?? "";
    expect(text).toContain("- aucun plan déclaré");
    expect(text).toContain("- démarré il y a 3 h\n");
  });

  test("nine runs show the eight oldest and point to peek_work", () => {
    const runs = many(9, (i) => run({ runId: `r${i}`, name: `run ${i}`, startedAt: NOW - (20 - i) * MIN }));
    const text = composeWorkSection(work({ runs: [...runs].reverse() }), NOW) ?? "";
    expect(text.match(/^### /gm)?.length).toBe(8);
    expect(text.indexOf("### run 0")).toBeLessThan(text.indexOf("### run 7"));
    expect(text).not.toContain("### run 8");
    expect(text).toContain("… 1 autre : `mcp__kibo__peek_work`");
  });

  test("more counts runs left out by the view", () => {
    expect(composeWorkSection(work({ more: 2 }), NOW)).toContain("… 2 autres : `mcp__kibo__peek_work`");
  });

  test("files, exports and steps are bounded", () => {
    const files = many(41, (i) => ({
      path: `src/f${String(i).padStart(2, "0")}.ts`,
      status: "added" as const,
      added: 1,
      removed: 0,
    }));
    const exports = many(41, (i) => ({ name: `name${String(i).padStart(2, "0")}`, path: "src/a.ts" }));
    const plan = many(31, (i) => ({ id: `s${i}`, title: `Étape ${i}`, status: "todo" as const, note: null }));
    const text = composeWorkSection(work({ runs: [run({ files, exports, plan })] }), NOW) ?? "";
    expect(text).toContain("`src/f39.ts`");
    expect(text).not.toContain("`src/f40.ts`");
    expect(text).toContain("`name39`");
    expect(text).not.toContain("`name40`");
    expect(text).toContain("30. [todo] Étape 29");
    expect(text).not.toContain("Étape 30");
    expect(text.match(/… 1 autre$/gm)?.length).toBe(3);
  });

  test("a truncated index is called partial", () => {
    expect(composeWorkSection(work({ runs: [run({ truncated: true })] }), NOW)).toContain(
      "- Fichiers créés ou modifiés (liste partielle) :",
    );
  });

  test("open overlaps are listed from the point of view of the caller", () => {
    const text = composeWorkSection(work({ overlaps: [overlap()] }), NOW) ?? "";
    expect(text).toContain(
      `${WORK_SECTION_OVERLAPS}\n\n- Recouvrement avec bou · livraison · BOU-12 : \`formatDate\``,
    );
    expect(text).toContain("(`src/utils/date.ts`, chez lui `src/lib/format.ts`)");
    const owner = composeWorkSection(
      work({ runs: [run({ runId: "r15", name: "bou · livraison · BOU-15" })], overlaps: [overlap()] }),
      NOW,
    );
    expect(owner).toContain("(`src/lib/format.ts`, chez lui `src/utils/date.ts`)");
  });

  test("ten overlaps at most", () => {
    const overlaps = many(12, (i) =>
      overlap({ id: `o${i}`, key: `k${i}`, detail: { kind: "file", path: `src/x${i}.ts` } }),
    );
    const text = composeWorkSection(work({ overlaps }), NOW) ?? "";
    expect(text.match(/^- Recouvrement avec/gm)?.length).toBe(10);
    expect(text).toContain("… 2 autres");
  });

  test("a partial detection is said", () => {
    expect(composeWorkSection(work({ partial: true }), NOW)).toContain("Détection partielle :");
  });

  test("a section over 8 000 characters is cut on a whole line and keeps its footer", () => {
    const runs = many(8, (i) =>
      run({
        runId: `r${i}`,
        name: `run ${i}`,
        files: many(40, (j) => ({
          path: `src/${"long-folder-name/".repeat(3)}file-${j}.ts`,
          status: "added" as const,
          added: 1,
          removed: 0,
        })),
      }),
    );
    const text = composeWorkSection(work({ runs }), NOW) ?? "";
    expect(text.length).toBeLessThanOrEqual(8_000);
    expect(text).toContain("\n… (section tronquée)\n");
    expect(text.endsWith(WORK_SECTION_FOOTER)).toBe(true);
  });

  test("secrets in export names are masked", () => {
    const secret = `ghp_${"a".repeat(30)}`;
    const text =
      composeWorkSection(work({ runs: [run({ exports: [{ name: secret, path: "src/a.ts" }] })] }), NOW) ?? "";
    expect(text).not.toContain(secret);
    expect(text).toContain(MASKED);
  });
});

describe("sectionFingerprint", () => {
  test("no section has a constant fingerprint", () => {
    expect(sectionFingerprint(null, hash)).toBe("none");
  });

  test("the elapsed time does not change the fingerprint", () => {
    const a = composeWorkSection(work(), NOW);
    const b = composeWorkSection(work(), NOW + 7 * MIN);
    expect(a).not.toBe(b);
    expect(sectionFingerprint(a, hash)).toBe(sectionFingerprint(b, hash));
  });

  test("a new file changes the fingerprint", () => {
    const before = composeWorkSection(work(), NOW);
    const files = [...run().files, { path: "src/new.ts", status: "added" as const, added: 1, removed: 0 }];
    const after = composeWorkSection(work({ runs: [run({ files })] }), NOW);
    expect(sectionFingerprint(before, hash)).not.toBe(sectionFingerprint(after, hash));
  });
});
