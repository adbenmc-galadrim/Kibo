import { afterEach, describe, expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import { applyBatch } from "./apply-batch";
import { type Harness, HUMAN, harness, propose, questionOf, seedQuestions } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});
const setup = () => {
  const h = harness();
  open.push(h);
  return h;
};

const why = "";
const all = (actions: readonly ProposedAction[]) => new Set(actions.map((a) => a.id));
const apply = (h: Harness, batch: Awaited<ReturnType<typeof propose>>, chosen = all(batch.actions)) =>
  applyBatch({ data: h.data, agents: () => h.agents, signals: h.signals }, batch, chosen, HUMAN);
const outcomes = (results: { outcome: string }[]) => results.map((r) => r.outcome);

describe("question actions", () => {
  test("a cleanup batch adds a recipient, asks, renames, reopens and archives in order", async () => {
    const h = setup();
    const q = seedQuestions(h);
    const batch = await propose(h, [
      { id: 1, why, type: "addRecipient", name: "Galadrim" },
      {
        id: 2,
        why,
        type: "createQuestion",
        ticket: q.ticket.key ?? "",
        title: "Quel hébergeur ?",
        recipient: "Galadrim",
      },
      { id: 3, why, type: "updateQuestion", questionId: q.open.id, title: "Couleur ?", recipient: "Client" },
      { id: 4, why, type: "reopenQuestion", questionId: q.delivered.id },
      { id: 5, why, type: "deleteQuestion", questionId: q.answered.id },
    ]);
    const results = await apply(h, batch);
    expect(outcomes(results)).toEqual(Array(5).fill("applied"));
    const snap = h.data.project(h.project.id);
    const galadrim = snap.questionRecipients.find((r) => r.name === "Galadrim");
    expect(galadrim).toBeDefined();
    expect(snap.questions.find((x) => x.title === "Quel hébergeur ?")?.recipient).toBe(galadrim?.id ?? "");
    const renamed = questionOf(h, q.open.id);
    expect(renamed).toMatchObject({ title: "Couleur ?", recipient: "client" });
    expect(renamed?.history[0]).toMatchObject({
      kind: "updated",
      previous: { title: "Client - Couleur ?", recipient: "me" },
    });
    expect(questionOf(h, q.delivered.id)?.answer).toBeNull();
    expect(questionOf(h, q.answered.id)?.archivedAt).not.toBeNull();
    expect(h.commands.map((c) => c.method).slice(-5)).toEqual([
      "addQuestionRecipient",
      "createQuestion",
      "updateQuestion",
      "reopenQuestion",
      "archiveQuestion",
    ]);
  });

  test("an unchecked recipient fails the question that names it, the rest goes on", async () => {
    const h = setup();
    const q = seedQuestions(h);
    const batch = await propose(h, [
      { id: 1, why, type: "addRecipient", name: "Galadrim" },
      {
        id: 2,
        why,
        type: "createQuestion",
        ticket: q.ticket.key ?? "",
        title: "Quel hébergeur ?",
        recipient: "Galadrim",
      },
      { id: 3, why, type: "deleteQuestion", questionId: q.answered.id },
    ]);
    const results = await apply(h, batch, new Set([2, 3]));
    expect(outcomes(results)).toEqual(["skipped", "failed", "applied"]);
    expect(results[1]?.detail).toBe("destinataire inconnu « Galadrim »");
  });

  test("a question renamed since the proposal is stale", async () => {
    const h = setup();
    const q = seedQuestions(h);
    const batch = await propose(h, [
      { id: 1, why, type: "updateQuestion", questionId: q.open.id, title: "Couleur ?" },
    ]);
    h.command({ method: "updateQuestion", questionId: q.open.id, title: "Teinte ?", by: HUMAN });
    const results = await apply(h, batch);
    expect(results[0]).toMatchObject({ outcome: "stale", detail: "modifié depuis la proposition : title" });
    expect(questionOf(h, q.open.id)?.title).toBe("Teinte ?");
  });
});
