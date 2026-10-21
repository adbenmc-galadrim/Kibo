import { expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import {
  actionDiff,
  actionDiffs,
  actionTitle,
  defaultLabels,
  groupActions,
  projectLabels,
  replacesContent,
  signalProvenance,
} from "./batch-groups";
import { pendingBatch, questionsProject, siloProject } from "./fixtures";
import { OPEN_SIGNALS } from "./signal-fixtures";

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
  [{ id: 1, type: "updateTicket", ticket: "SILO-1", title: "X", why: "" }, "Modifier SILO-1"],
  [
    { id: 1, type: "setStatus", ticket: "SILO-1", statusId: "in_review", why: "" },
    "SILO-1 : passer en En review",
  ],
  [{ id: 1, type: "link", from: "SILO-1", to: "new:2", kind: "blocks", why: "" }, "SILO-1 bloque new:2"],
  [
    { id: 1, type: "unlink", from: "SILO-1", to: "SILO-2", kind: "relates", why: "" },
    "Retirer le lien entre SILO-1 et SILO-2",
  ],
  [{ id: 1, type: "assignAgent", ticket: "SILO-1", profileId: "opus", why: "" }, "Assigner SILO-1 à opus"],
  [{ id: 1, type: "deliverAnswers", ticket: "SILO-1", why: "" }, "Transmettre les réponses de SILO-1"],
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
    { id: 1, type: "createQuestion", ticket: "SILO-1", title: "Doc ?", why: "" },
    "Question sur SILO-1 : « Doc ? »",
  ],
  [{ id: 1, type: "createNote", path: "a/b.md", content: "", why: "" }, "Créer la note a/b.md"],
  [{ id: 1, type: "updateNote", path: "a/b.md", content: "", why: "" }, "Mettre à jour la note a/b.md"],
  [
    { id: 1, type: "updateQuestion", questionId: "q", title: "B", why: "" },
    "Modifier la question « question introuvable »",
  ],
  [
    { id: 1, type: "reopenQuestion", questionId: "q", why: "" },
    "Rouvrir « question introuvable » (réponse retirée)",
  ],
  [{ id: 1, type: "deleteQuestion", questionId: "q", why: "" }, "Archiver « question introuvable »"],
  [{ id: 1, type: "addRecipient", name: "Galadrim", why: "" }, "Ajouter le destinataire « Galadrim »"],
];

test("actionTitle names each action type", () => {
  for (const [action, title] of titles) expect(actionTitle(action)).toBe(title);
});

test("actionDiff shows before → after from the captured state", () => {
  const status: ProposedAction = {
    id: 2,
    type: "setStatus",
    ticket: "SILO-11",
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
    ticket: "SILO-12",
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
    ticket: "SILO-12",
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
  const status: ProposedAction = { id: 2, type: "setStatus", ticket: "SILO-11", statusId: "done", why: "" };
  const labels = { ...defaultLabels, status: (id: string) => id.toUpperCase() };
  expect(actionDiff(status, { actionId: 2, fields: { statusId: "todo" } }, labels)).toEqual({
    before: "TODO",
    after: "DONE",
  });
});

test("a parent change shows the captured parentId as a key from the project, never a raw id", () => {
  const labels = projectLabels(siloProject());
  const move = (parent: string | null): ProposedAction => ({
    id: 3,
    type: "updateTicket",
    ticket: "SILO-12",
    parent,
    why: "",
  });
  expect(actionDiff(move("SILO-11"), { actionId: 3, fields: { parentId: null } }, labels)).toEqual({
    before: "aucun",
    after: "SILO-11",
  });
  expect(actionDiff(move(null), { actionId: 3, fields: { parentId: "t11" } }, labels)).toEqual({
    before: "SILO-11",
    after: "aucun",
  });
  expect(
    actionDiff(
      move("new:1"),
      { actionId: 3, fields: { parentId: "9f3c2a71-0000-4000-8000-000000000000" } },
      labels,
    ),
  ).toEqual({ before: "ticket introuvable", after: "new:1" });
  expect(actionDiff(move("SILO-11"), undefined, labels)).toEqual({ before: "—", after: "SILO-11" });
});

test("an assignment names the agent, never its ref", () => {
  const assign: ProposedAction = { id: 1, type: "assignAgent", ticket: "SILO-1", profileId: "p-42", why: "" };
  const labels = projectLabels(siloProject(), [{ ref: "p-42", name: "opus-dev" }]);
  expect(actionTitle(assign, labels)).toBe("Assigner SILO-1 à opus-dev");
  expect(actionTitle({ ...assign, profileId: "global:gone" }, labels)).toBe("Assigner SILO-1 à gone");
});

test("dismissSignal goes to the Signaux group, after Notes, with its own title", () => {
  const dismiss: ProposedAction = { id: 9, type: "dismissSignal", signal: "sig:3", why: "Déjà connu" };
  const groups = groupActions([...pendingBatch().actions, dismiss]);
  expect(groups.at(-1)).toEqual({ group: "signals", actions: [dismiss] });
  expect(actionTitle(dismiss)).toBe("Signal sig:3 : sans suite");
});

test("signalProvenance names the kind and the run of each cited signal", () => {
  const cited: ProposedAction = {
    id: 1,
    type: "createTicket",
    ref: "new:1",
    title: "Tests",
    why: "",
    signals: ["sig:1", "sig:2", "sig:9"],
  };
  expect(signalProvenance(cited, OPEN_SIGNALS)).toEqual([
    "signal Ticket à créer de opus-dev-2",
    "signal Blocage de opus-dev-3",
  ]);
  expect(signalProvenance({ ...cited, signals: undefined }, OPEN_SIGNALS)).toEqual([]);
});

test("question actions read the title and the recipient from the project", () => {
  const labels = projectLabels(questionsProject());
  const title = (action: ProposedAction) => actionTitle(action, labels);
  expect(title({ id: 1, type: "updateQuestion", questionId: "q-logo", title: "Logo ?", why: "" })).toBe(
    "Modifier la question « Client - Logo ? »",
  );
  expect(title({ id: 1, type: "reopenQuestion", questionId: "q-logo", why: "" })).toBe(
    "Rouvrir « Client - Logo ? » (réponse retirée)",
  );
  expect(title({ id: 1, type: "deleteQuestion", questionId: "q-port", why: "" })).toBe(
    "Archiver « Quel port ? »",
  );
  expect(title({ id: 1, type: "deleteQuestion", questionId: "gone", why: "" })).toBe(
    "Archiver « question introuvable »",
  );
  expect(
    title({
      id: 1,
      type: "createQuestion",
      ticket: "SILO-11",
      title: "Police ?",
      recipient: "client",
      why: "",
    }),
  ).toBe("Question sur SILO-11 pour Client : « Police ? »");
  expect(
    title({
      id: 1,
      type: "createQuestion",
      ticket: "SILO-11",
      title: "Police ?",
      recipient: "Juridique",
      why: "",
    }),
  ).toBe("Question sur SILO-11 pour Juridique : « Police ? »");
  expect(labels.recipient("galadrim")).toBe("Galadrim");
  expect(labels.question("q-port")).toBe("Quel port ?");
  expect(defaultLabels.question("q-port")).toBeNull();
});

test("an updated question shows one before → after line per field, the recipient in plain words", () => {
  const labels = projectLabels(questionsProject());
  const update: ProposedAction = {
    id: 4,
    type: "updateQuestion",
    questionId: "q-logo",
    title: "Logo ?",
    recipient: "Galadrim",
    ticket: "SILO-12",
    options: ["Grand", "Petit"],
    provisional: "Grand",
    context: "Nouveau contexte",
    why: "",
  };
  const expected = {
    actionId: 4,
    fields: {
      title: "Client - Logo ?",
      recipient: "client",
      ticketId: "t11",
      options: ["Oui", "Non"],
      provisional: null,
      context: "Le logo",
      delivered: false,
    },
  };
  expect(actionDiffs(update, expected, labels)).toEqual([
    { field: "Titre", before: "Client - Logo ?", after: "Logo ?" },
    { field: "Destinataire", before: "Client", after: "Galadrim" },
    { field: "Ticket", before: "SILO-11", after: "SILO-12" },
    { field: "Options", before: "Oui, Non", after: "Grand, Petit" },
    { field: "Choix provisoire", before: "aucun", after: "Grand" },
  ]);
  expect(replacesContent(update)).toBe(true);
  expect(replacesContent({ ...update, context: undefined })).toBe(false);
  expect(
    actionDiffs(
      {
        ...update,
        title: undefined,
        recipient: undefined,
        ticket: undefined,
        options: undefined,
        provisional: undefined,
      },
      undefined,
      labels,
    ),
  ).toEqual([]);
  const status: ProposedAction = { id: 2, type: "setStatus", ticket: "SILO-11", statusId: "done", why: "" };
  expect(actionDiffs(status, undefined, labels)).toEqual([{ before: "—", after: "Terminé" }]);
});
