import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import type { CommandMeta } from "../docs";
import { questionActorInterceptor } from "./question-actor";

const USER: CommandMeta = { origin: "user", instanceId: "i1" };
const intercept = questionActorInterceptor((projectId) => (projectId === "p1" ? "adam" : "lea"));

const create: ProjectCommand = {
  method: "createQuestion",
  ticketId: "t1",
  title: "Bloquer le dépôt ?",
  createdBy: { kind: "agent", ref: "x" },
};
const answer: ProjectCommand = {
  method: "answerQuestion",
  questionId: "q1",
  answer: { kind: "confirm" },
  by: { kind: "agent", ref: "emis-livraison" },
};

test("a user or a component always writes questions as the viewer of the project", () => {
  expect(intercept("p1", create, USER)).toEqual({ ...create, createdBy: { kind: "human", ref: "adam" } });
  expect(intercept("p2", answer, { origin: "user", instanceId: null })).toEqual({
    ...answer,
    by: { kind: "human", ref: "lea" },
  });
});

test("an import keeps its label, the daemon and the sync keep theirs, other commands pass", () => {
  const imported: ProjectCommand = { ...create, createdBy: { kind: "import", ref: "plan" } };
  expect(intercept("p1", imported, USER)).toBe(imported);
  expect(intercept("p1", create, { origin: "agent", instanceId: null })).toBe(create);
  expect(intercept("p1", answer, { origin: "sync", instanceId: null })).toBe(answer);
  const other: ProjectCommand = { method: "removeQuestion", questionId: "q1" };
  expect(intercept("p1", other, USER)).toBe(other);
});
