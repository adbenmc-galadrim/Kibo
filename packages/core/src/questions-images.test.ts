import { expect, test } from "bun:test";
import { type Actor, Question } from "@kibo/schema";
import { executeProjectCommand } from "./commands";
import { createProjectDoc } from "./project";
import { listQuestions } from "./questions";
import { createTicket } from "./tickets";

const AGENT: Actor = { kind: "agent", ref: "emis-livraison" };
const IMAGE = { id: "i1", name: "1-no-access.png", bytes: 1200, width: 800, height: 600 };

const projectDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "EMIS",
    name: "Emis",
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

test("a validation question keeps its kind and image metadata in the document", () => {
  const doc = projectDoc();
  const ticket = createTicket(doc, { title: "Écran d'accès" });
  const created = Question.parse(
    executeProjectCommand(doc, {
      method: "createQuestion",
      ticketId: ticket.id,
      title: "Valider l'écran 1.2 ?",
      createdBy: AGENT,
      kind: "validation",
      images: [IMAGE],
    }),
  );
  expect(created.kind).toBe("validation");
  expect(created.images).toEqual([IMAGE]);
  expect(listQuestions(doc)[0]?.images).toEqual([IMAGE]);
});

test("a question created without kind is an ordinary question without images", () => {
  const doc = projectDoc();
  const ticket = createTicket(doc, { title: "Écran d'accès" });
  const created = Question.parse(
    executeProjectCommand(doc, {
      method: "createQuestion",
      ticketId: ticket.id,
      title: "Port ?",
      createdBy: AGENT,
    }),
  );
  expect(created.kind).toBe("question");
  expect(created.images).toEqual([]);
});
