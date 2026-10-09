import { describe, expect, test } from "bun:test";
import { type Batch, RunState } from "@kibo/schema";
import fc from "fast-check";
import { type ChangeNames, changeNames, diffFingerprints, renderDigest } from "./digest";
import { fingerprint, type ProjectFingerprint, type TicketPrint } from "./fingerprint";
import { HUMAN, project, question, run, ticket } from "./test-kit";

const names: ChangeNames = {
  ticket: (id) => `T(${id})`,
  question: (id) => `Q(${id})`,
  run: (id) => `R(${id})`,
};

const print = (p: Partial<TicketPrint> = {}): TicketPrint => ({
  key: "EMIS-1",
  title: "Un",
  statusId: "todo",
  labels: [],
  parentId: null,
  assignee: null,
  branch: null,
  pr: null,
  ...p,
});

const empty: ProjectFingerprint = { tickets: {}, questions: {}, runs: {}, notes: {} };
const base: ProjectFingerprint = {
  tickets: { t1: print() },
  questions: { q1: "open" },
  runs: { r1: "running" },
  notes: { "a.md": "h1" },
};

describe("diffFingerprints", () => {
  test("two identical fingerprints have no change", () => {
    expect(diffFingerprints(base, base, names)).toEqual([]);
    expect(renderDigest([], null)).toBe(
      "## Depuis ton dernier tour\n\nAucun changement depuis ton dernier tour.",
    );
  });

  test("a renamed ticket whose status changed gives two lines", () => {
    const after = { ...base, tickets: { t1: print({ title: "Deux", statusId: "in_progress" }) } };
    expect(diffFingerprints(base, after, names)).toEqual([
      { category: "tickets", key: "t1", text: "T(t1) : titre « Un » → « Deux »" },
      { category: "tickets", key: "t1", text: "T(t1) : statut todo → in_progress" },
    ]);
  });

  test("every ticket field is compared one by one", () => {
    const after = {
      ...base,
      tickets: {
        t1: print({ labels: ["ui"], parentId: "t9", assignee: "opus", branch: "feat/x", pr: "#3 (open)" }),
      },
    };
    expect(diffFingerprints(base, after, names).map((c) => c.text)).toEqual([
      "T(t1) : étiquettes aucune → ui",
      "T(t1) : parent aucun → t9",
      "T(t1) : assigné aucun → opus",
      "T(t1) : branche aucune → feat/x",
      "T(t1) : PR aucune → #3 (open)",
    ]);
  });

  test("a deleted ticket gives one line, a created one too", () => {
    const after = { ...base, tickets: { t2: print({ key: "EMIS-2", title: "Deux" }) } };
    expect(diffFingerprints(base, after, names)).toEqual([
      { category: "tickets", key: "t1", text: "Ticket supprimé : T(t1)" },
      { category: "tickets", key: "t2", text: "Ticket créé : T(t2)" },
    ]);
  });

  test("an answered question, a changed note, a finished run: one line each", () => {
    const after = {
      ...base,
      questions: { q1: "answered" as const },
      notes: { "a.md": "h2" },
      runs: { r1: "done" as const },
    };
    expect(diffFingerprints(base, after, names)).toEqual([
      { category: "runs", key: "r1", text: "Run R(r1) : en cours → terminé" },
      { category: "questions", key: "q1", text: "Question répondue : Q(q1)" },
      { category: "notes", key: "a.md", text: "Note modifiée : a.md" },
    ]);
  });

  test("new and removed runs, questions and notes", () => {
    expect(diffFingerprints(base, { ...empty, tickets: base.tickets }, names).map((c) => c.text)).toEqual([
      "Run retiré : R(r1)",
      "Question supprimée : Q(q1)",
      "Note supprimée : a.md",
    ]);
    const after = {
      ...base,
      runs: { ...base.runs, r2: "queued" as const },
      questions: { ...base.questions, q2: "open" as const, q3: "answered" as const },
      notes: { ...base.notes, "b.md": "x" },
    };
    expect(diffFingerprints(base, after, names).map((c) => c.text)).toEqual([
      "Nouveau run R(r2) : en file",
      "Question posée : Q(q2)",
      "Question posée et répondue : Q(q3)",
      "Note créée : b.md",
    ]);
  });
});

describe("changeNames", () => {
  test("names come from the current project, then from the previous fingerprint", () => {
    const before = fingerprint({
      project: project({ tickets: [ticket({ id: "t9", title: "Supprimé" })] }),
      runs: [],
      notes: [],
    });
    const current = project({
      tickets: [ticket({ id: "t1", title: "Un" })],
      questions: [question({ id: "q1", ticketId: "t1", title: "Quoi ?" })],
    });
    const named = changeNames(current, [run({ id: "r1", label: "opus-dev · EMIS-1" })], before);
    expect(named.ticket("t1")).toBe("EMIS-1 · Un");
    expect(named.ticket("t9")).toBe("EMIS-9 · Supprimé");
    expect(named.ticket("zz")).toBe("zz");
    expect(named.question("q1")).toBe("Quoi ?");
    expect(named.question("q0")).toBe("q0");
    expect(named.run("r1")).toBe("opus-dev · EMIS-1");
    expect(named.run("r0")).toBe("r0");
  });
});

const lastBatch = (p: Partial<Batch>): Batch => ({
  id: "b3",
  projectId: "p1",
  runId: "r1",
  sessionId: "s1",
  seq: 3,
  summary: "",
  actions: [],
  expected: [],
  createdAt: 0,
  status: "partial",
  decidedBy: HUMAN,
  decidedAt: 1,
  chosen: null,
  comment: null,
  results: [],
  ...p,
});

const result = (actionId: number, outcome: "applied" | "stale" | "failed" | "skipped") => ({
  actionId,
  outcome,
  detail: null,
  created: null,
});

describe("renderDigest", () => {
  test("the last decided batch opens the digest", () => {
    const results = [
      result(1, "applied"),
      result(2, "applied"),
      result(3, "applied"),
      result(4, "stale"),
      result(5, "skipped"),
      result(6, "skipped"),
    ];
    expect(renderDigest([], lastBatch({ results }))).toBe(
      [
        "## Depuis ton dernier tour",
        "",
        "Dernier lot : n° 3 — appliqué 3, périmé 1, échec 0, ignoré 2",
        "",
        "Aucun changement depuis ton dernier tour.",
      ].join("\n"),
    );
    expect(renderDigest([], lastBatch({ status: "rejected" }))).toContain("Dernier lot : n° 3 — refusé");
  });

  test("lists changes one per line", () => {
    const text = renderDigest([{ category: "notes", key: "a.md", text: "Note créée : a.md" }], null);
    expect(text).toBe("## Depuis ton dernier tour\n\n- Note créée : a.md");
  });

  test("beyond the limit: totals by category, the first 50, then a pointer", () => {
    const changes = [
      ...Array.from({ length: 3 }, (_, i) => ({ category: "runs" as const, key: `r${i}`, text: `run ${i}` })),
      ...Array.from({ length: 100 }, (_, i) => ({
        category: "tickets" as const,
        key: `t${i}`,
        text: `ticket ${i}`,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        category: "questions" as const,
        key: `q${i}`,
        text: `q ${i}`,
      })),
      ...Array.from({ length: 7 }, (_, i) => ({ category: "notes" as const, key: `n${i}`, text: `n ${i}` })),
    ];
    const lines = renderDigest(changes, null).split("\n");
    expect(lines[2]).toBe("120 changements : 3 runs, 100 tickets, 10 questions, 7 notes");
    expect(lines.filter((l) => l.startsWith("- "))).toHaveLength(50);
    expect(lines.at(-1)).toBe("… le reste par `project_changes`.");
  });
});

const ID = fc.constantFrom("a", "b", "c", "d");
const ticketPrint = fc.record({
  key: fc.option(fc.constantFrom("EMIS-1", "EMIS-2"), { nil: null }),
  title: fc.constantFrom("Un", "Deux"),
  statusId: fc.constantFrom("todo", "done"),
  labels: fc.subarray(["ui", "api"]),
  parentId: fc.option(ID, { nil: null }),
  assignee: fc.option(fc.constantFrom("opus", "adam"), { nil: null }),
  branch: fc.option(fc.constantFrom("feat/a"), { nil: null }),
  pr: fc.option(fc.constantFrom("#1 (open)"), { nil: null }),
});
const fingerprints = fc.record({
  tickets: fc.dictionary(ID, ticketPrint),
  questions: fc.dictionary(ID, fc.constantFrom("open" as const, "answered" as const)),
  runs: fc.dictionary(ID, fc.constantFrom(...RunState.options)),
  notes: fc.dictionary(fc.constantFrom("a.md", "b.md"), fc.constantFrom("h1", "h2")),
});

const reversed = (fp: ProjectFingerprint): ProjectFingerprint => ({
  tickets: Object.fromEntries(Object.entries(fp.tickets).reverse()),
  questions: Object.fromEntries(Object.entries(fp.questions).reverse()),
  runs: Object.fromEntries(Object.entries(fp.runs).reverse()),
  notes: Object.fromEntries(Object.entries(fp.notes).reverse()),
});

const keysOf = (fp: ProjectFingerprint): string[] => [
  ...Object.keys(fp.tickets),
  ...Object.keys(fp.questions),
  ...Object.keys(fp.runs),
  ...Object.keys(fp.notes),
];

describe("digest properties", () => {
  test("diff(a, a) is empty", () => {
    fc.assert(fc.property(fingerprints, (a) => diffFingerprints(a, a, names).length === 0));
  });

  test("a diff only cites identifiers of a ∪ b", () => {
    fc.assert(
      fc.property(fingerprints, fingerprints, (a, b) => {
        const known = new Set([...keysOf(a), ...keysOf(b)]);
        return diffFingerprints(a, b, names).every((c) => known.has(c.key));
      }),
    );
  });

  test("the order does not depend on the order of the entries", () => {
    fc.assert(
      fc.property(fingerprints, fingerprints, (a, b) => {
        expect(diffFingerprints(reversed(a), reversed(b), names)).toEqual(diffFingerprints(a, b, names));
      }),
    );
  });
});
