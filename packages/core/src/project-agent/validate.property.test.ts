import { describe, expect, test } from "bun:test";
import { type ProposedAction, StatusId } from "@kibo/schema";
import fc from "fast-check";
import { isNewRef, ticketRefsOf } from "./refs";
import { answered, link, PROFILES, project, question, run, ticket } from "./test-kit";
import { type BatchContext, validateBatch } from "./validate";

const ctx: BatchContext = {
  project: project({
    tickets: [ticket({ id: "t1" }), ticket({ id: "t2", parentId: "t1" }), ticket({ id: "t3" })],
    links: [link("l1", "t1", "t2"), link("l2", "t2", "t3", "relates")],
    questions: [
      question({ id: "q1", ticketId: "t1", provisional: "A" }),
      answered(question({ id: "q2", ticketId: "t3" })),
    ],
  }),
  runs: [
    run({ id: "r1", ticketId: "t2", state: "running" }),
    run({ id: "r3", projectId: "other", state: "running" }),
  ],
  notes: [{ path: "a.md", hash: "h1" }],
  profiles: PROFILES,
  demoProject: false,
  viewer: "adam",
};

const ref = fc.constantFrom("EMIS-1", "EMIS-2", "EMIS-3", "EMIS-999", "new:1", "new:2", "new:3");
const why = fc.constant("");
type Draft = ProposedAction extends infer A ? (A extends ProposedAction ? Omit<A, "id"> : never) : never;

const draft: fc.Arbitrary<Draft> = fc.oneof(
  fc.record({
    why,
    type: fc.constant("createTicket" as const),
    ref: fc.constantFrom("new:1", "new:2", "new:3"),
    title: fc.constant("Neuf"),
    parent: fc.option(ref, { nil: undefined }),
  }),
  fc.record({
    why,
    type: fc.constant("updateTicket" as const),
    ticket: ref,
    title: fc.option(fc.constant("Titre"), { nil: undefined }),
    parent: fc.option(fc.option(ref, { nil: null }), { nil: undefined }),
  }),
  fc.record({
    why,
    type: fc.constant("setStatus" as const),
    ticket: ref,
    statusId: fc.constantFrom(...StatusId.options),
    blockedReason: fc.option(fc.constant("attente"), { nil: undefined }),
  }),
  fc.record({
    why,
    type: fc.constant("link" as const),
    from: ref,
    to: ref,
    kind: fc.constant("blocks" as const),
  }),
  fc.record({
    why,
    type: fc.constant("unlink" as const),
    from: ref,
    to: ref,
    kind: fc.constantFrom("blocks" as const, "relates" as const),
  }),
  fc.record({
    why,
    type: fc.constant("assignAgent" as const),
    ticket: ref,
    profileId: fc.constantFrom("opus", "assistant", "demo", "nope"),
  }),
  fc.record({ why, type: fc.constant("deliverAnswers" as const), ticket: ref }),
  fc.record({ why, type: fc.constant("cancelRun" as const), runId: fc.constantFrom("r1", "r3", "rx") }),
  fc.record({
    why,
    type: fc.constant("answerQuestion" as const),
    questionId: fc.constantFrom("q1", "q2", "qx"),
    answer: fc.constant({ kind: "confirm" as const }),
  }),
  fc.record({
    why,
    type: fc.constant("createNote" as const),
    path: fc.constantFrom("a.md", "b.md"),
    content: fc.constant(""),
  }),
  fc.record({
    why,
    type: fc.constant("updateNote" as const),
    path: fc.constantFrom("a.md", "b.md"),
    content: fc.constant(""),
  }),
);

const batches = fc
  .array(draft, { minLength: 1, maxLength: 8 })
  .map((drafts) => drafts.map((d, i): ProposedAction => ({ ...d, id: i + 1 })));

const keys = new Set(ctx.project.tickets.map((t) => t.key));
const questions = new Set(ctx.project.questions.map((q) => q.id));
const runs = new Set(ctx.runs.filter((r) => r.projectId === ctx.project.meta.id).map((r) => r.id));

function citesOnlyTheProject(action: ProposedAction): boolean {
  const refsOk = ticketRefsOf(action).every((r) => isNewRef(r) || keys.has(r));
  if (action.type === "answerQuestion") return refsOk && questions.has(action.questionId);
  if (action.type === "cancelRun") return refsOk && runs.has(action.runId);
  return refsOk;
}

function refsDeclaredBeforeUse(actions: readonly ProposedAction[]): boolean {
  const declared = new Set<string>();
  for (const action of actions) {
    if (!ticketRefsOf(action).every((r) => !isNewRef(r) || declared.has(r))) return false;
    if (action.type === "createTicket") {
      if (declared.has(action.ref)) return false;
      declared.add(action.ref);
    }
  }
  return true;
}

describe("validateBatch properties", () => {
  test("an accepted batch declares its new: references once, before use, and cites only the project", () => {
    fc.assert(
      fc.property(batches, (actions) => {
        const result = validateBatch({ summary: "Lot", actions }, ctx);
        if (!result.ok) return true;
        return refsDeclaredBeforeUse(result.batch.actions) && result.batch.actions.every(citesOnlyTheProject);
      }),
      { numRuns: 500 },
    );
  });

  test("validation is idempotent", () => {
    fc.assert(
      fc.property(batches, (actions) => {
        const result = validateBatch({ summary: "Lot", actions }, ctx);
        if (!result.ok) return;
        expect(validateBatch({ summary: "Lot", actions: result.batch.actions }, ctx)).toEqual(result);
      }),
      { numRuns: 300 },
    );
  });

  test("the generator does produce accepted batches", () => {
    const accepted = fc
      .sample(batches, { numRuns: 500, seed: 18 })
      .filter((actions) => validateBatch({ summary: "Lot", actions }, ctx).ok);
    expect(accepted.length).toBeGreaterThan(10);
  });
});
