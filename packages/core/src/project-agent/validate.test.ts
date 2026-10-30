import { describe, expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProposeBatchInput, type ProposedAction } from "@kibo/schema";
import { answered, link, project, question, run, ticket } from "./test-kit";
import { type BatchContext, validateBatch } from "./validate";

const snapshot = project({
  tickets: [
    ticket({ id: "t1", title: "Un", statusId: "in_progress", description: "d1", labels: ["ui"] }),
    ticket({ id: "t2", title: "Deux", parentId: "t1" }),
    ticket({ id: "t3", title: "Trois" }),
  ],
  links: [link("l1", "t1", "t2"), link("l2", "t2", "t3", "relates")],
  questions: [
    question({ id: "q1", ticketId: "t1", options: ["A", "B"], provisional: "A" }),
    answered(question({ id: "q2", ticketId: "t3" })),
  ],
});

const ctx = (p: Partial<BatchContext> = {}): BatchContext => ({
  project: snapshot,
  runs: [
    run({ id: "r1", ticketId: "t2", state: "running" }),
    run({ id: "r2", ticketId: "t3", state: "done" }),
    run({ id: "r3", projectId: "other", ticketId: "x", state: "running" }),
  ],
  notes: [{ path: "a.md", hash: "h1" }],
  viewer: "adam",
  ...p,
});

const batch = (...actions: ProposedAction[]): ProposeBatchInput => ({ summary: "Lot", actions });
const problems = (input: ProposeBatchInput, c = ctx()) => {
  const result = validateBatch(input, c);
  return result.ok ? [] : result.problems.map((p) => `#${p.actionId} ${p.message}`);
};
const why = "";

describe("validateBatch refuses a batch that lies about its targets", () => {
  test("unknown ticket", () => {
    expect(problems(batch({ id: 1, why, type: "updateTicket", ticket: "SILO-999", title: "x" }))).toEqual([
      "#1 ticket inconnu « SILO-999 »",
    ]);
  });

  test("status outside the project workflow", () => {
    const narrow = ctx({
      project: { ...snapshot, workflow: DEFAULT_WORKFLOW.filter((s) => s.id !== "in_review") },
    });
    expect(
      problems(batch({ id: 1, why, type: "setStatus", ticket: "SILO-1", statusId: "in_review" }), narrow),
    ).toEqual(["#1 statut inconnu « in_review »"]);
  });

  test("blocked needs a reason", () => {
    expect(problems(batch({ id: 1, why, type: "setStatus", ticket: "SILO-1", statusId: "blocked" }))).toEqual(
      ["#1 raison de blocage requise"],
    );
  });

  test("questions of another project or already answered", () => {
    const answer = (questionId: string) =>
      batch({ id: 1, why, type: "answerQuestion", questionId, answer: { kind: "confirm" } });
    expect(problems(answer("q-other"))).toEqual(["#1 question inconnue « q-other »"]);
    expect(problems(answer("q2"))).toEqual(["#1 question déjà répondue « q2 »"]);
    expect(problems(answer("q1"))).toEqual([]);
    expect(
      problems(
        batch({
          id: 1,
          why,
          type: "answerQuestion",
          questionId: "q1",
          answer: { kind: "option", option: "C" },
        }),
      ),
    ).toEqual(["#1 réponse invalide : option inconnue « C »"]);
    expect(
      problems(
        batch({ id: 1, why, type: "answerQuestion", questionId: "q1", answer: { kind: "text", text: " " } }),
      ),
    ).toEqual(["#1 réponse invalide : texte vide"]);
  });

  test("notes: create an existing one or update a missing one", () => {
    expect(problems(batch({ id: 1, why, type: "createNote", path: "a.md", content: "" }))).toEqual([
      "#1 note déjà existante « a.md »",
    ]);
    expect(problems(batch({ id: 1, why, type: "updateNote", path: "b.md", content: "" }))).toEqual([
      "#1 note introuvable « b.md »",
    ]);
  });

  test("a link that creates a blocks cycle, including through new:", () => {
    expect(
      problems(batch({ id: 1, why, type: "link", from: "SILO-2", to: "SILO-1", kind: "blocks" })),
    ).toEqual(["#1 lien en cycle : SILO-2 → SILO-1"]);
    expect(
      problems(
        batch(
          { id: 1, why, type: "createTicket", ref: "new:1", title: "Nouveau" },
          { id: 2, why, type: "link", from: "SILO-3", to: "new:1", kind: "blocks" },
          { id: 3, why, type: "link", from: "new:1", to: "SILO-3", kind: "blocks" },
        ),
      ),
    ).toEqual(["#3 lien en cycle : new:1 → SILO-3"]);
    expect(
      problems(batch({ id: 1, why, type: "link", from: "SILO-1", to: "SILO-2", kind: "blocks" })),
    ).toEqual(["#1 lien déjà présent"]);
    expect(
      problems(batch({ id: 1, why, type: "link", from: "SILO-1", to: "SILO-1", kind: "blocks" })),
    ).toEqual(["#1 un ticket ne peut pas se lier à lui-même"]);
  });

  test("unlink needs an existing link, relates in either direction", () => {
    expect(
      problems(batch({ id: 1, why, type: "unlink", from: "SILO-3", to: "SILO-2", kind: "relates" })),
    ).toEqual([]);
    expect(
      problems(batch({ id: 1, why, type: "unlink", from: "SILO-2", to: "SILO-1", kind: "blocks" })),
    ).toEqual(["#1 lien introuvable"]);
  });

  test("an unlinked dependency no longer counts for cycles", () => {
    expect(
      problems(
        batch(
          { id: 1, why, type: "unlink", from: "SILO-1", to: "SILO-2", kind: "blocks" },
          { id: 2, why, type: "link", from: "SILO-2", to: "SILO-1", kind: "blocks" },
        ),
      ),
    ).toEqual([]);
  });

  test("new: references are declared once, before use", () => {
    expect(
      problems(
        batch(
          { id: 1, why, type: "updateTicket", ticket: "new:2", title: "x" },
          { id: 2, why, type: "createTicket", ref: "new:2", title: "Deux" },
        ),
      ),
    ).toEqual(["#1 référence new:2 déclarée après usage"]);
    expect(
      problems(
        batch(
          { id: 1, why, type: "createTicket", ref: "new:1", title: "A" },
          { id: 2, why, type: "createTicket", ref: "new:1", title: "B" },
        ),
      ),
    ).toEqual(["#2 référence new:1 déclarée deux fois"]);
    expect(problems(batch({ id: 1, why, type: "setStatus", ticket: "new:7", statusId: "todo" }))).toEqual([
      "#1 référence new:7 inconnue",
    ]);
  });

  test("two actions on the same field of the same target", () => {
    expect(
      problems(
        batch(
          { id: 1, why, type: "updateTicket", ticket: "SILO-1", title: "A" },
          { id: 2, why, type: "updateTicket", ticket: "SILO-1", title: "B", description: "d" },
        ),
      ),
    ).toEqual(["#2 deux actions sur SILO-1.title"]);
  });

  test("parents never form a cycle", () => {
    expect(problems(batch({ id: 1, why, type: "updateTicket", ticket: "SILO-1", parent: "SILO-2" }))).toEqual(
      ["#1 parent en cycle : SILO-2"],
    );
    expect(problems(batch({ id: 1, why, type: "updateTicket", ticket: "SILO-1", parent: "SILO-1" }))).toEqual(
      ["#1 parent en cycle : SILO-1"],
    );
    expect(problems(batch({ id: 1, why, type: "updateTicket", ticket: "SILO-3", parent: "SILO-2" }))).toEqual(
      [],
    );
  });

  test("an update with nothing to change is refused", () => {
    expect(problems(batch({ id: 1, why, type: "updateTicket", ticket: "SILO-1" }))).toEqual([
      "#1 rien à modifier",
    ]);
  });

  test("question options are distinct and the provisional choice is one of them", () => {
    expect(
      problems(
        batch({ id: 1, why, type: "createQuestion", ticket: "SILO-1", title: "?", options: ["A", "A"] }),
      ),
    ).toEqual(["#1 options en double"]);
    expect(
      problems(
        batch({
          id: 1,
          why,
          type: "createQuestion",
          ticket: "SILO-1",
          title: "?",
          options: ["A"],
          provisional: "B",
        }),
      ),
    ).toEqual(["#1 choix provisoire hors des options"]);
  });

  test("action ids are distinct", () => {
    expect(
      problems(
        batch(
          { id: 1, why, type: "createNote", path: "b.md", content: "" },
          { id: 1, why, type: "createNote", path: "c.md", content: "" },
        ),
      ),
    ).toEqual(["#1 identifiant d'action en double"]);
  });

  test("300 valid actions are accepted", () => {
    const many = Array.from(
      { length: 300 },
      (_, i): ProposedAction => ({
        id: i + 1,
        why,
        type: "createTicket",
        ref: `new:${i + 1}`,
        title: `Ticket ${i + 1}`,
      }),
    );
    const result = validateBatch(batch(...many), ctx());
    expect(result.ok && result.batch.actions.length).toBe(300);
  });
});

describe("validateBatch and features", () => {
  test("a feature with a parent is refused", () => {
    expect(
      problems(
        batch({
          id: 1,
          why,
          type: "createTicket",
          ref: "new:1",
          title: "F",
          feature: true,
          parent: "SILO-3",
        }),
      ),
    ).toEqual(["#1 une fonctionnalité est un ticket racine"]);
  });

  test("a feature created in the batch is a root for setSprint", () => {
    expect(
      problems(
        batch(
          {
            id: 1,
            why,
            type: "createSprint",
            code: "S43",
            name: "S43",
            start: "2026-11-02",
            end: "2026-11-06",
          },
          { id: 2, why, type: "createTicket", ref: "new:1", title: "Tournée", feature: true },
          { id: 3, why, type: "createTicket", ref: "new:2", title: "Dépôt", parent: "new:1" },
          { id: 4, why, type: "setSprint", ticket: "new:1", sprint: "S43" },
        ),
      ),
    ).toEqual([]);
  });
});
