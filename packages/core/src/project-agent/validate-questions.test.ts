import { describe, expect, test } from "bun:test";
import type { ProposeBatchInput, ProposedAction, QuestionRecipient } from "@kibo/schema";
import { questionContext, questionSnapshot } from "./test-kit";
import { type BatchContext, validateBatch } from "./validate";

const why = "";
const batch = (...actions: ProposedAction[]): ProposeBatchInput => ({ summary: "Lot", actions });
const problems = (input: ProposeBatchInput, c: BatchContext = questionContext()) => {
  const result = validateBatch(input, c);
  return result.ok ? [] : result.problems.map((p) => `#${p.actionId} ${p.message}`);
};
type UpdateFields = Omit<
  Extract<ProposedAction, { type: "updateQuestion" }>,
  "id" | "why" | "type" | "questionId"
>;
const update = (questionId: string, fields: UpdateFields, id = 1): ProposedAction => ({
  id,
  why,
  type: "updateQuestion",
  questionId,
  ...fields,
});
const reopen = (questionId: string, id = 1): ProposedAction => ({
  id,
  why,
  type: "reopenQuestion",
  questionId,
});
const remove = (questionId: string, id = 1): ProposedAction => ({
  id,
  why,
  type: "deleteQuestion",
  questionId,
});
const addRecipient = (name: string, id = 1): ProposedAction => ({ id, why, type: "addRecipient", name });
const UNKNOWN_GALADRIM =
  "destinataire inconnu « Galadrim » ; destinataires du projet : Moi (technique), Produit, Client ; ajoute-le par addRecipient";

describe("validateBatch on question actions", () => {
  test("an unknown or archived question", () => {
    expect(problems(batch(update("x", { title: "B" })))).toEqual(["#1 question inconnue « x »"]);
    expect(problems(batch(reopen("x")))).toEqual(["#1 question inconnue « x »"]);
    expect(problems(batch(remove("x")))).toEqual(["#1 question inconnue « x »"]);
    expect(problems(batch(update("q4", { title: "B" })))).toEqual(["#1 question archivée « q4 »"]);
    expect(problems(batch(reopen("q4")))).toEqual(["#1 question archivée « q4 »"]);
    expect(
      problems(
        batch({ id: 1, why, type: "answerQuestion", questionId: "q4", answer: { kind: "text", text: "x" } }),
      ),
    ).toEqual(["#1 question archivée « q4 »"]);
    expect(problems(batch(remove("q4")))).toEqual(["#1 question déjà archivée « q4 »"]);
  });

  test("an update changes something and respects the answer", () => {
    expect(problems(batch(update("q1", {})))).toEqual(["#1 rien à modifier"]);
    expect(problems(batch(update("q3", { title: "B" })))).toEqual([
      "#1 réponse déjà transmise à un agent : rouvre-la d'abord (reopenQuestion)",
    ]);
    expect(problems(batch(update("q2", { options: ["X"] })))).toEqual([
      "#1 question répondue : options et choix provisoire figés, rouvre-la d'abord",
    ]);
    expect(problems(batch(update("q2", { title: "Deux bis" })))).toEqual([]);
  });

  test("options stay distinct and the provisional choice stays among them", () => {
    expect(problems(batch(update("q1", { options: ["A", "A"] })))).toEqual(["#1 options en double"]);
    expect(problems(batch(update("q1", { provisional: "C" })))).toEqual([
      "#1 choix provisoire hors des options",
    ]);
    expect(problems(batch(update("q1", { options: ["C"], provisional: "C" })))).toEqual([]);
    expect(problems(batch(update("q1", { options: ["C", "D"] })))).toEqual([
      "#1 choix provisoire hors des options",
    ]);
  });

  test("the question of an active run is answered, not moved nor archived", () => {
    const active = "#1 question d'un run actif « opus-dev-1 » : réponds-y";
    expect(problems(batch(remove("q5")))).toEqual([active]);
    expect(problems(batch(update("q5", { ticket: "SILO-1" })))).toEqual([active]);
    expect(problems(batch(update("q5", { title: "Cinq bis" })))).toEqual([]);
    expect(problems(batch(remove("q5")), questionContext({ runs: [] }))).toEqual([]);
  });

  test("a ticket target follows the reference rules", () => {
    expect(problems(batch(update("q1", { ticket: "SILO-9" })))).toEqual(["#1 ticket inconnu « SILO-9 »"]);
    expect(problems(batch(update("q1", { ticket: "new:1" })))).toEqual(["#1 référence new:1 inconnue"]);
  });

  test("a recipient is one of the project or declared above in the batch", () => {
    expect(problems(batch(update("q1", { recipient: "Galadrim" })))).toEqual([`#1 ${UNKNOWN_GALADRIM}`]);
    expect(problems(batch(update("q1", { recipient: "client" })))).toEqual([]);
    expect(problems(batch(update("q1", { recipient: "  produit " })))).toEqual([]);
    expect(problems(batch(addRecipient("Galadrim", 1), update("q1", { recipient: "galadrim" }, 2)))).toEqual(
      [],
    );
    expect(problems(batch(update("q1", { recipient: "galadrim" }, 1), addRecipient("Galadrim", 2)))).toEqual([
      "#1 destinataire inconnu « galadrim » ; destinataires du projet : Moi (technique), Produit, Client ; ajoute-le par addRecipient",
    ]);
    const create: ProposedAction = {
      id: 1,
      why,
      type: "createQuestion",
      ticket: "SILO-1",
      title: "Q",
      recipient: "Galadrim",
    };
    expect(problems(batch(create))).toEqual([`#1 ${UNKNOWN_GALADRIM}`]);
  });

  test("reopening needs an answered question", () => {
    expect(problems(batch(reopen("q1")))).toEqual(["#1 question déjà ouverte"]);
    expect(problems(batch(reopen("q2")))).toEqual([]);
    expect(problems(batch(reopen("q3")))).toEqual([]);
  });

  test("a reopened question may then be updated in the same batch, not before", () => {
    expect(problems(batch(reopen("q3", 1), update("q3", { title: "B", options: ["X"] }, 2)))).toEqual([]);
    expect(problems(batch(update("q3", { title: "B" }, 1), reopen("q3", 2)))).toEqual([
      "#1 réponse déjà transmise à un agent : rouvre-la d'abord (reopenQuestion)",
    ]);
    expect(problems(batch(update("q2", { recipient: "client" }, 1), reopen("q2", 2)))).toEqual([
      "#2 question modifiée plus haut dans le lot : place la réouverture avant la modification",
    ]);
  });

  test("a recipient is added once and the project keeps twenty at most", () => {
    expect(problems(batch(addRecipient("client")))).toEqual(["#1 destinataire déjà présent"]);
    expect(problems(batch(addRecipient("Client")))).toEqual(["#1 destinataire déjà présent"]);
    expect(problems(batch(addRecipient("Malik", 1), addRecipient("malik", 2)))).toEqual([
      "#2 destinataire déjà présent",
    ]);
    const recipients: QuestionRecipient[] = Array.from({ length: 18 }, (_, i) => ({
      id: `r${i}`,
      name: `R${i}`,
    }));
    const full = questionContext({ project: { ...questionSnapshot(), questionRecipients: recipients } });
    expect(problems(batch(addRecipient("A", 1), addRecipient("B", 2), addRecipient("C", 3)), full)).toEqual([
      "#3 20 destinataires au plus",
    ]);
  });

  test("one change per question, except an answer and an update", () => {
    expect(problems(batch(update("q1", { title: "B" }, 1), remove("q1", 2)))).toEqual([
      "#2 deux actions sur q1.question",
    ]);
    expect(problems(batch(remove("q2", 1), reopen("q2", 2)))).toEqual(["#2 deux actions sur q2.answer"]);
    const answer: ProposedAction = {
      id: 1,
      why,
      type: "answerQuestion",
      questionId: "q1",
      answer: { kind: "confirm" },
    };
    expect(problems(batch(answer, update("q1", { title: "B" }, 2)))).toEqual([]);
  });

  test("a cleanup of 48 actions on 48 questions is accepted", () => {
    const [open, answer] = questionSnapshot().questions;
    if (!open || !answer) throw new Error("fixture");
    const questions = Array.from({ length: 48 }, (_, i) => ({ ...(i < 32 ? open : answer), id: `c${i}` }));
    const c = questionContext({ project: { ...questionSnapshot(), questions } });
    const actions = questions.map((q, i): ProposedAction => {
      if (i < 16) return update(q.id, { title: `Q${i}` }, i + 1);
      return i < 32 ? remove(q.id, i + 1) : reopen(q.id, i + 1);
    });
    const result = validateBatch(batch(...actions), c);
    expect(result.ok && result.batch.actions.length).toBe(48);
  });
});
