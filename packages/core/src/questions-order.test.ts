import { expect, test } from "bun:test";
import type { Actor } from "@kibo/schema";
import fc from "fast-check";
import { createProjectDoc } from "./project";
import { createQuestion, listQuestions } from "./questions";
import { createTicket } from "./tickets";

const AGENT: Actor = { kind: "agent", ref: "emis-livraison" };

const newProjectDoc = (key: string) =>
  createProjectDoc({
    id: "p1",
    key,
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
  });

test("questions created in the same millisecond come back in creation order, every time", () => {
  fc.assert(
    fc.property(fc.array(fc.nat(3), { minLength: 1, maxLength: 12 }), fc.nat(1_000), (steps, start) => {
      const doc = newProjectDoc("KIB");
      const t = createTicket(doc, { title: "T" });
      let at = start;
      const created = steps.map((step, i) => {
        at += step === 0 ? 1 : 0;
        return createQuestion(doc, { ticketId: t.id, title: `Q${i}`, createdBy: AGENT, at }).id;
      });
      return (
        listQuestions(doc)
          .map((q) => q.id)
          .join() === created.join()
      );
    }),
    { numRuns: 100 },
  );
});

test("a question keeps the time it was given when no other question holds it", () => {
  const doc = newProjectDoc("KIB");
  const t = createTicket(doc, { title: "T" });
  const first = createQuestion(doc, { ticketId: t.id, title: "A", createdBy: AGENT, at: 10 });
  const second = createQuestion(doc, { ticketId: t.id, title: "B", createdBy: AGENT, at: 10 });
  const third = createQuestion(doc, { ticketId: t.id, title: "C", createdBy: AGENT, at: 50 });
  expect([first.createdAt, second.createdAt, third.createdAt]).toEqual([10, 11, 50]);
});
