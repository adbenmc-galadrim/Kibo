import { describe, expect, test } from "bun:test";
import { PLAN_ACTION_TYPES, type PlanAction, type PlanOutcome } from "@kibo/schema";
import { outcomeLines, previewLines, problemLines } from "./plan-text";

const base = { why: "" };
const ACTIONS: PlanAction[] = [
  { ...base, id: 1, type: "createTicket", ref: "new:1", title: "Tournée et dépôt", feature: true },
  { ...base, id: 2, type: "createTicket", ref: "new:2", title: "Lire le fichier", parent: "new:1" },
  { ...base, id: 3, type: "createTicket", ref: "new:3", title: "Ticket seul" },
  { ...base, id: 4, type: "link", from: "SILO-131", to: "new:2", kind: "blocks" },
  { ...base, id: 5, type: "unlink", from: "SILO-33", to: "SILO-34", kind: "blocks" },
  {
    ...base,
    id: 6,
    type: "createSprint",
    code: "S21",
    name: "Dépôt",
    start: "2026-11-02",
    end: "2026-11-13",
  },
  { ...base, id: 7, type: "setSprint", ticket: "new:1", sprint: "S21" },
  { ...base, id: 8, type: "updateTicket", ticket: "SILO-33", title: "Nouveau", labels: ["web"] },
  { ...base, id: 9, type: "setStatus", ticket: "SILO-33", statusId: "blocked", blockedReason: "Accès" },
  { ...base, id: 10, type: "setHold", ticket: "SILO-34", reason: "Attente client" },
  { ...base, id: 11, type: "createQuestion", ticket: "new:2", title: "Quel format ?" },
  { ...base, id: 12, type: "answerQuestion", questionId: "q1", answer: { kind: "option", option: "CSV" } },
  { ...base, id: 13, type: "updateQuestion", questionId: "q2", title: "Autre" },
  { ...base, id: 14, type: "reopenQuestion", questionId: "q3" },
  { ...base, id: 15, type: "deleteQuestion", questionId: "q4" },
  { ...base, id: 16, type: "addRecipient", name: "client" },
];

const KEYS = { "new:1": "F43", "new:2": "SILO-139", "new:3": "SILO-140" };

describe("previewLines", () => {
  test("one line per action, predicted keys after the new refs", () => {
    expect(previewLines(ACTIONS, KEYS)).toEqual([
      "1. crée la fonctionnalité « Tournée et dépôt » → F43",
      "2. crée l'étape « Lire le fichier » sous new:1 (→ F43) → SILO-139",
      "3. crée le ticket « Ticket seul » → SILO-140",
      "4. SILO-131 bloque new:2 (→ SILO-139)",
      "5. SILO-33 ne bloque plus SILO-34",
      "6. crée le sprint S21 « Dépôt » du 2026-11-02 au 2026-11-13",
      "7. pose S21 sur new:1 (→ F43)",
      "8. modifie SILO-33 : titre, étiquettes",
      "9. passe SILO-33 en blocked (Accès)",
      "10. met SILO-34 en attente : Attente client",
      "11. ajoute la question « Quel format ? » sur new:2 (→ SILO-139)",
      "12. répond à la question q1 : CSV",
      "13. modifie la question q2",
      "14. rouvre la question q3",
      "15. supprime la question q4",
      "16. ajoute le destinataire client",
    ]);
  });

  test("every plan action type has its own wording", () => {
    const covered = new Set(ACTIONS.map((a) => a.type));
    expect([...covered].sort()).toEqual([...PLAN_ACTION_TYPES].sort());
  });

  test("the opposite forms", () => {
    const lines = previewLines(
      [
        { ...base, id: 1, type: "setSprint", ticket: "F5", sprint: null },
        { ...base, id: 2, type: "setHold", ticket: "SILO-34", reason: null },
        { ...base, id: 3, type: "unlink", from: "SILO-33", to: "SILO-34", kind: "relates" },
        { ...base, id: 4, type: "setStatus", ticket: "SILO-33", statusId: "done" },
        { ...base, id: 5, type: "answerQuestion", questionId: "q1", answer: { kind: "text", text: "Libre" } },
        { ...base, id: 6, type: "updateTicket", ticket: "SILO-33", description: "x", parent: null },
      ],
      {},
    );
    expect(lines).toEqual([
      "1. retire le sprint de F5",
      "2. lève l'attente de SILO-34",
      "3. retire le lien entre SILO-33 et SILO-34",
      "4. passe SILO-33 en done",
      "5. répond à la question q1 : Libre",
      "6. modifie SILO-33 : description, parent",
    ]);
  });

  test("an unknown key says so", () => {
    const keys = { "new:1": null, "new:2": null };
    expect(previewLines(ACTIONS.slice(0, 2), keys)).toEqual([
      "1. crée la fonctionnalité « Tournée et dépôt » (clé inconnue)",
      "2. crée l'étape « Lire le fichier » sous new:1 (clé inconnue) (clé inconnue)",
    ]);
  });

  test("lines follow the action ids", () => {
    const [first, second] = ACTIONS;
    if (!first || !second) throw new Error("fixture");
    expect(previewLines([{ ...second, id: 9 }, first], KEYS)[0]).toStartWith("1. ");
  });
});

describe("outcomeLines", () => {
  const plan = ACTIONS.slice(0, 4);

  test("applied actions, created keys", () => {
    const outcome: PlanOutcome = {
      problems: [],
      results: [
        { actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t1", key: "SILO-138" } },
        { actionId: 2, outcome: "applied", detail: null, created: { ticketId: "t2", key: "SILO-139" } },
        { actionId: 3, outcome: "applied", detail: null, created: { ticketId: "t3", key: "SILO-140" } },
        { actionId: 4, outcome: "applied", detail: null, created: null },
      ],
      created: [
        { ref: "new:1", ticketId: "t1", key: "F43" },
        { ref: "new:2", ticketId: "t2", key: "SILO-139" },
        { ref: "new:3", ticketId: "t3", key: "SILO-140" },
      ],
      stoppedAt: null,
    };
    expect(outcomeLines(plan, outcome)).toEqual([
      "✓ 1. F43 créée : Tournée et dépôt",
      "✓ 2. SILO-139 créée : Lire le fichier",
      "✓ 3. SILO-140 créée : Ticket seul",
      "✓ 4. SILO-131 bloque new:2 (→ SILO-139)",
      "Créés : new:1 → F43, new:2 → SILO-139, new:3 → SILO-140",
    ]);
  });

  test("a stopped plan shows the failure, the skipped actions and what was created", () => {
    const outcome: PlanOutcome = {
      problems: [],
      results: [
        { actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t1", key: "SILO-138" } },
        { actionId: 2, outcome: "applied", detail: null, created: { ticketId: "t2", key: "SILO-139" } },
        { actionId: 3, outcome: "failed", detail: "boom", created: null },
        { actionId: 4, outcome: "skipped", detail: "arrêt après l'échec de #3", created: null },
      ],
      created: [
        { ref: "new:1", ticketId: "t1", key: "F43" },
        { ref: "new:2", ticketId: "t2", key: "SILO-139" },
      ],
      stoppedAt: 3,
    };
    expect(outcomeLines(plan, outcome)).toEqual([
      "✓ 1. F43 créée : Tournée et dépôt",
      "✓ 2. SILO-139 créée : Lire le fichier",
      "✗ 3. crée le ticket « Ticket seul » : boom",
      "– 4. ignorée : arrêt après l'échec de #3",
      "Créés : new:1 → F43, new:2 → SILO-139",
      "Arrêt à l'action 3.",
    ]);
  });

  test("nothing created, no created line", () => {
    const outcome: PlanOutcome = {
      problems: [],
      results: [{ actionId: 4, outcome: "applied", detail: null, created: null }],
      created: [],
      stoppedAt: null,
    };
    expect(outcomeLines([ACTIONS[3] as PlanAction], outcome)).toEqual(["✓ 4. SILO-131 bloque new:2"]);
  });
});

describe("problemLines", () => {
  test("#id type : message", () => {
    expect(
      problemLines([
        { actionId: 4, type: "link", message: "ticket inconnu : SILO-999" },
        { actionId: 7, type: "setSprint", message: "sprint inconnu : S99" },
      ]),
    ).toEqual(["#4 link : ticket inconnu : SILO-999", "#7 setSprint : sprint inconnu : S99"]);
  });
});
