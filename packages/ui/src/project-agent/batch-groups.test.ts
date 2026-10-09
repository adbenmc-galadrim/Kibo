import { expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import { actionDiff, actionTitle, groupActions, replacesContent } from "./batch-groups";
import { pendingBatch } from "./fixtures";

test("groupActions keeps Tickets, Agents, Questions, Notes and the id order inside each group", () => {
  const shuffled = [...pendingBatch().actions].reverse();
  expect(groupActions(shuffled).map((g) => [g.group, g.actions.map((a) => a.id)])).toEqual([
    ["tickets", [1, 2, 3]],
    ["agents", [4]],
    ["questions", [5, 6]],
    ["notes", [7]],
  ]);
  expect(
    groupActions([{ id: 1, type: "createNote", path: "a.md", content: "", why: "" }]).map((g) => g.group),
  ).toEqual(["notes"]);
});

const titles: [ProposedAction, string][] = [
  [{ id: 1, type: "createTicket", ref: "new:1", title: "Tests", why: "" }, "Créer le ticket « Tests »"],
  [{ id: 1, type: "updateTicket", ticket: "EMIS-1", title: "X", why: "" }, "Modifier EMIS-1"],
  [
    { id: 1, type: "setStatus", ticket: "EMIS-1", statusId: "in_review", why: "" },
    "EMIS-1 : passer en En review",
  ],
  [{ id: 1, type: "link", from: "EMIS-1", to: "new:2", kind: "blocks", why: "" }, "EMIS-1 bloque new:2"],
  [
    { id: 1, type: "unlink", from: "EMIS-1", to: "EMIS-2", kind: "relates", why: "" },
    "Retirer le lien entre EMIS-1 et EMIS-2",
  ],
  [{ id: 1, type: "assignAgent", ticket: "EMIS-1", profileId: "opus", why: "" }, "Assigner EMIS-1 à opus"],
  [{ id: 1, type: "deliverAnswers", ticket: "EMIS-1", why: "" }, "Transmettre les réponses de EMIS-1"],
  [{ id: 1, type: "cancelRun", runId: "r9", why: "" }, "Annuler le run r9"],
  [
    { id: 1, type: "answerQuestion", questionId: "q", answer: { kind: "confirm" }, why: "" },
    "Répondre « Confirmer »",
  ],
  [
    {
      id: 1,
      type: "answerQuestion",
      questionId: "q",
      answer: { kind: "option", option: "Virgule" },
      why: "",
    },
    "Répondre « Virgule »",
  ],
  [
    { id: 1, type: "answerQuestion", questionId: "q", answer: { kind: "text", text: "Oui" }, why: "" },
    "Répondre « Oui »",
  ],
  [
    { id: 1, type: "createQuestion", ticket: "EMIS-1", title: "Doc ?", why: "" },
    "Question sur EMIS-1 : « Doc ? »",
  ],
  [{ id: 1, type: "createNote", path: "a/b.md", content: "", why: "" }, "Créer la note a/b.md"],
  [{ id: 1, type: "updateNote", path: "a/b.md", content: "", why: "" }, "Mettre à jour la note a/b.md"],
];

test("actionTitle names each of the twelve action types", () => {
  for (const [action, title] of titles) expect(actionTitle(action)).toBe(title);
});

test("actionDiff shows before → after from the captured state", () => {
  const status: ProposedAction = {
    id: 2,
    type: "setStatus",
    ticket: "EMIS-11",
    statusId: "in_review",
    why: "",
  };
  expect(actionDiff(status, { actionId: 2, fields: { statusId: "in_progress" } })).toEqual({
    before: "En cours",
    after: "En review",
  });
  const rename: ProposedAction = {
    id: 3,
    type: "updateTicket",
    ticket: "EMIS-12",
    title: "Nouveau",
    why: "",
  };
  expect(actionDiff(rename, { actionId: 3, fields: { title: "Ancien" } })).toEqual({
    before: "Ancien",
    after: "Nouveau",
  });
  const labels: ProposedAction = {
    id: 3,
    type: "updateTicket",
    ticket: "EMIS-12",
    labels: ["ui", "bug"],
    why: "",
  };
  expect(actionDiff(labels, { actionId: 3, fields: { labels: [] } })).toEqual({
    before: "aucun",
    after: "ui, bug",
  });
  const note: ProposedAction = { id: 7, type: "updateNote", path: "m.md", content: "x", why: "" };
  expect(actionDiff(note, { actionId: 7, fields: { hash: "abc" } })).toBeNull();
  expect(replacesContent(note)).toBe(true);
  expect(actionDiff(status, undefined)).toEqual({ before: "—", after: "En review" });
  expect(actionDiff({ id: 1, type: "cancelRun", runId: "r", why: "" }, undefined)).toBeNull();
});

test("custom workflow labels are used when given", () => {
  const status: ProposedAction = { id: 2, type: "setStatus", ticket: "EMIS-11", statusId: "done", why: "" };
  expect(actionDiff(status, { actionId: 2, fields: { statusId: "todo" } }, (id) => id.toUpperCase())).toEqual(
    {
      before: "TODO",
      after: "DONE",
    },
  );
});
