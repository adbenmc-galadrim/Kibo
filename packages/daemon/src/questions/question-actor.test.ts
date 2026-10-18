import { expect, test } from "bun:test";
import type { Actor, ProjectCommand } from "@kibo/schema";
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
  by: { kind: "agent", ref: "silo-livraison" },
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

const editsBy = (by: Actor): ProjectCommand[] => [
  { method: "updateQuestion", questionId: "q1", by, title: "B" },
  { method: "updateAnswer", questionId: "q1", answer: { kind: "text", text: "x" }, by },
  { method: "reopenQuestion", questionId: "q1", by },
  { method: "archiveQuestion", questionId: "q1", by },
  { method: "restoreQuestion", questionId: "q1", by },
];

test("the five question edits are written as the viewer, an import keeps its label", () => {
  const asViewer = editsBy({ kind: "human", ref: "adam" });
  editsBy({ kind: "agent", ref: "x" }).forEach((edit, i) => {
    expect(intercept("p1", edit, USER)).toEqual(asViewer[i] ?? edit);
    expect(intercept("p1", edit, { origin: "sync", instanceId: null })).toBe(edit);
  });
  for (const imported of editsBy({ kind: "import", ref: "plan" }))
    expect(intercept("p1", imported, USER)).toBe(imported);
});

test("only the daemon attaches images: a user or a component never does", () => {
  const image = { id: "i1", name: "x.png", bytes: 10, width: null, height: null };
  const withImages: ProjectCommand = { ...create, kind: "validation", images: [image] };
  expect(intercept("p1", withImages, USER)).toEqual({
    ...create,
    kind: "validation",
    images: [],
    createdBy: { kind: "human", ref: "adam" },
  });
  const imported: ProjectCommand = { ...withImages, createdBy: { kind: "import", ref: "plan" } };
  expect(intercept("p1", imported, USER)).toEqual({ ...imported, images: [] });
  expect(intercept("p1", withImages, { origin: "agent", instanceId: null })).toBe(withImages);
});
