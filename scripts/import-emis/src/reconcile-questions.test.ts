import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import fc from "fast-check";
import { reconcile } from "./reconcile";
import {
  applyLocally,
  emptySnapshot,
  fixtureDesired,
  ref,
  withLegacyArbitrages,
  withTicket,
} from "./reconcile.test-kit";
import { IMPORT_ACTOR, reconcileQuestions } from "./reconcile-questions";

const desired = fixtureDesired();
const IMPORT = IMPORT_ACTOR;
const imported = () => applyLocally(emptySnapshot(), reconcile(emptySnapshot(), desired));
const methods = (commands: readonly ProjectCommand[], method: string) =>
  commands.filter((c) => c.method === method);
const idOf = (snapshot: ReturnType<typeof imported>, id: string) =>
  snapshot.tickets.find((t) => t.externalRefs.some((r) => r.kind === "import_ref" && r.id === id))?.id ?? "";
const answerOf = (snapshot: ReturnType<typeof imported>, id: string) =>
  snapshot.questions.find((q) => q.importRef?.id === id)?.answer;

test("a first import creates every question on its ticket, answered when the plan answers it", () => {
  const plan = reconcile(emptySnapshot(), desired);
  expect(methods(plan.commands, "createQuestion")).toHaveLength(3);
  expect(methods(plan.commands, "answerQuestion")).toHaveLength(2);
  const after = applyLocally(emptySnapshot(), plan);
  expect(after.questions.map((q) => [q.importRef?.id, q.ticketId, q.blocking, q.createdBy])).toEqual([
    ["Q1", idOf(after, "C0-3"), true, IMPORT],
    ["Q2", idOf(after, "arbitrages"), true, IMPORT],
    ["Q3", idOf(after, "C1-2"), true, IMPORT],
  ]);
  expect(answerOf(after, "Q3")).toMatchObject({
    kind: "text",
    text: "Oui, un seul bouton.",
    by: IMPORT,
    at: Date.parse("2026-10-06T10:00:00Z"),
    deliveredAt: null,
  });
  expect(answerOf(after, "Q2")?.text).toBe("Résolue dans le plan Emis");
  expect(reconcile(after, desired).commands).toEqual([]);
});

test("kibo wins on answers: answered in kibo is kept, open in kibo and answered in the plan is answered", () => {
  const base = imported();
  const answeredInKibo = {
    ...base,
    questions: base.questions.map((q) =>
      q.importRef?.id === "Q1" || q.importRef?.id === "Q3"
        ? {
            ...q,
            answer: {
              kind: "text" as const,
              option: null,
              text: "Réponse d'Adam",
              by: { kind: "human" as const, ref: "adam" },
              at: 1,
              deliveredAt: null,
              deliveredRunId: null,
            },
          }
        : q,
    ),
  };
  const kept = reconcileQuestions(answeredInKibo, desired.questions, new Map());
  expect(kept.commands).toEqual([]);
  expect(kept.changes.map((c) => c.kind)).toEqual(["kept", "kept", "kept"]);

  const reopened = { ...base, questions: base.questions.map((q) => ({ ...q, answer: null })) };
  const ids = new Map<string, string>();
  for (const t of base.tickets)
    for (const r of t.externalRefs) if (r.kind === "import_ref") ids.set(`${r.source}:${r.id}`, t.id);
  const answered = reconcileQuestions(reopened, desired.questions, ids);
  expect(answered.commands).toEqual([
    {
      method: "answerQuestion",
      questionId: "q2",
      answer: { kind: "text", text: "Résolue dans le plan Emis" },
      by: IMPORT,
      at: Date.parse("2026-10-06"),
    },
    {
      method: "answerQuestion",
      questionId: "q3",
      answer: { kind: "text", text: "Oui, un seul bouton." },
      by: IMPORT,
      at: Date.parse("2026-10-06T10:00:00Z"),
    },
  ]);
  expect(answered.changes.filter((c) => c.kind === "updated")).toHaveLength(2);
});

test("a question without import ref is found by its ticket and title", () => {
  const base = imported();
  const stripped = { ...base, questions: base.questions.map((q) => ({ ...q, importRef: null })) };
  expect(reconcile(stripped, desired).commands).toEqual([]);
});

test("the old sub-tickets are migrated: question created, answer copied, links removed, ticket deleted", () => {
  const legacy = withLegacyArbitrages(
    { ...imported(), questions: [] },
    { Q1: "**Compte AWS** au nom du client. Estelle.\n\n## Réponse\n\nCompte créé le 7.\n\n## Suite\n\nx\n" },
  );
  const plan = reconcile(legacy, desired);
  expect(methods(plan.commands, "createQuestion")).toHaveLength(3);
  expect(methods(plan.commands, "removeLink")).toHaveLength(2);
  const deletions = methods(plan.commands, "deleteTicket");
  expect(deletions).toHaveLength(3 + 2);
  const legacyIds = new Set(
    legacy.tickets
      .filter((t) => t.externalRefs.some((r) => r.kind === "import_ref" && /^Q\d+$|^arbitrages\//.test(r.id)))
      .map((t) => t.id),
  );
  for (const c of deletions) expect(c.method === "deleteTicket" && legacyIds.has(c.ticketId)).toBe(true);
  expect(plan.changes.filter((c) => c.kind === "migrated")).toHaveLength(5);
  expect(plan.changes.filter((c) => c.kind === "orphan" || c.kind === "drift")).toEqual([]);
  const last = plan.commands.findIndex((c) => c.method === "removeLink" || c.method === "deleteTicket");
  expect(plan.commands.slice(0, last).some((c) => c.method === "createQuestion")).toBe(true);
  expect(
    plan.commands.slice(last).every((c) => c.method === "removeLink" || c.method === "deleteTicket"),
  ).toBe(true);

  const after = applyLocally(legacy, plan);
  expect(after.tickets.some((t) => legacyIds.has(t.id))).toBe(false);
  expect(answerOf(after, "Q1")?.text).toBe("Compte créé le 7.");
  expect(answerOf(after, "Q3")?.text).toBe("Oui, un seul bouton.");
  expect(after.tickets.find((t) => t.title.startsWith("C0-3 · "))?.statusId).toBe("blocked");
  const again = reconcile(after, desired);
  expect(again.commands).toEqual([]);
  expect(again.changes.filter((c) => c.kind !== "kept")).toEqual([]);
});

test("a legacy group holding a foreign ticket is kept and reported, its questions still migrate", () => {
  const legacy = withLegacyArbitrages({ ...imported(), questions: [] });
  const group = legacy.tickets.find((t) => t.title === "Internes")?.id ?? null;
  const foreign = withTicket(legacy, { title: "Ajouté à la main", parentId: group });
  const plan = reconcile(foreign, desired);
  const deleted = new Set(
    methods(plan.commands, "deleteTicket").map((c) => (c.method === "deleteTicket" ? c.ticketId : "")),
  );
  expect(deleted.has(group ?? "")).toBe(false);
  expect(deleted.size).toBe(4);
  expect(plan.changes).toContainEqual(
    expect.objectContaining({ kind: "drift", what: "ticket arbitrages/internes" }),
  );
  const after = applyLocally(foreign, plan);
  expect(after.tickets.some((t) => t.title === "Ajouté à la main")).toBe(true);
});

test("a legacy question ticket that the plan no longer has is an orphan, never deleted", () => {
  const legacy = withLegacyArbitrages({ ...imported(), questions: [] });
  const trimmed = { ...desired, questions: desired.questions.filter((q) => q.ref.id !== "Q2") };
  const plan = reconcile(legacy, trimmed);
  const q2 = legacy.tickets.find((t) => t.externalRefs.some((r) => r.kind === "import_ref" && r.id === "Q2"));
  expect(
    methods(plan.commands, "deleteTicket").some((c) => c.method === "deleteTicket" && c.ticketId === q2?.id),
  ).toBe(false);
  expect(plan.changes).toContainEqual(expect.objectContaining({ kind: "orphan", what: "ticket Q2" }));
});

test("reconciling twice is idempotent for any subset of questions, from any old state", () => {
  fc.assert(
    fc.property(fc.subarray(desired.questions), fc.boolean(), (questions, old) => {
      const d = { ...desired, questions };
      const start = old ? withLegacyArbitrages(emptySnapshot()) : emptySnapshot();
      const after = applyLocally(start, reconcile(start, d));
      return reconcile(after, d).commands.length === 0;
    }),
  );
});

test("no command deletes anything but a legacy question ticket", () => {
  const legacy = withLegacyArbitrages({ ...imported(), questions: [] });
  const strangers = withTicket(withTicket(legacy, { title: "Q99 · Sans réf" }), {
    title: "Autre",
    externalRefs: [ref("todo", "Q1")],
  });
  const plan = reconcile(strangers, { ...desired, tickets: desired.tickets.slice(0, 3), links: [] });
  const legacyIds = new Set(
    strangers.tickets
      .filter((t) =>
        t.externalRefs.some(
          (r) => r.kind === "import_ref" && r.source === "plan" && /^Q\d+$|^arbitrages\//.test(r.id),
        ),
      )
      .map((t) => t.id),
  );
  const destructive = plan.commands.filter(
    (c) => c.method.startsWith("delete") || c.method.startsWith("remove"),
  );
  for (const c of destructive) {
    if (c.method === "deleteTicket") expect(legacyIds.has(c.ticketId)).toBe(true);
    else expect(c.method).toBe("removeLink");
  }
});
