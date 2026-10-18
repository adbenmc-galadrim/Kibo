import { expect, test } from "bun:test";
import { type Actor, KiboError } from "@kibo/schema";
import { readProject } from "./commands";
import { createProjectDoc } from "./project";
import { addQuestionRecipient } from "./question-recipients";
import {
  answerQuestion,
  createQuestion,
  listQuestions,
  openCountByTicket,
  openQuestionCount,
  pruneQuestions,
} from "./questions";
import { archiveQuestion } from "./questions-edit";
import { createTicket } from "./tickets";

const ADAM: Actor = { kind: "human", ref: "adam" };

function setup() {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
  const ticket = createTicket(doc, { title: "Stockage" });
  const ask = (title: string) => createQuestion(doc, { ticketId: ticket.id, title, createdBy: ADAM, at: 1 });
  const archive = (questionId: string) =>
    archiveQuestion(doc, { method: "archiveQuestion", questionId, by: ADAM });
  return { doc, ticket, ask, archive };
}

test("a question is created for a known recipient, me by default", () => {
  const { doc, ticket, ask } = setup();
  expect(ask("Q").recipient).toBe("me");
  const galadrim = addQuestionRecipient(doc, "Galadrim", "galadrim");
  const routed = createQuestion(doc, {
    ticketId: ticket.id,
    title: "R",
    recipient: galadrim.id,
    createdBy: ADAM,
  });
  expect(routed.recipient).toBe("galadrim");
  expect(() =>
    createQuestion(doc, { ticketId: ticket.id, title: "S", recipient: "nope", createdBy: ADAM }),
  ).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
});

test("an archived question cannot be answered", () => {
  const { doc, ask, archive } = setup();
  const q = archive(ask("Q").id);
  let error: unknown = null;
  try {
    answerQuestion(doc, q.id, { kind: "text", text: "Oui" }, ADAM, 2);
  } catch (e) {
    error = e;
  }
  expect(error instanceof KiboError && error.code).toBe("INVALID_TRANSITION");
  expect(error instanceof KiboError ? error.message : "").toContain("archived");
});

test("archived questions leave the dedupe and the open counts, and die with their ticket", () => {
  const { doc, ticket, ask, archive } = setup();
  const first = archive(ask("Q").id);
  const again = ask("Q");
  expect(again.id).not.toBe(first.id);
  archive(again.id);
  expect(openQuestionCount(doc, ticket.id)).toBe(0);
  expect(openCountByTicket(listQuestions(doc)).size).toBe(0);
  expect(readProject(doc, "2026-10-16").tickets[0]?.openQuestions).toBe(0);
  pruneQuestions(doc, [ticket.id]);
  expect(listQuestions(doc)).toEqual([]);
});
