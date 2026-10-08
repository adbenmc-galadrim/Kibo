import { expect, test } from "bun:test";
import { join } from "node:path";
import { desiredQuestions } from "./desired-questions";
import { loadAnswers, loadPlan } from "./plan-source";
import { ref } from "./reconcile.test-kit";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "emis");
const plan = loadPlan(join(FIXTURE, "tmp", "plan-data.js"));
const answers = loadAnswers(join(FIXTURE, "tmp", "reponses.json"));

test("each plan question is a blocking imported question on the ticket it blocks", () => {
  expect(desiredQuestions(plan, answers)).toEqual([
    {
      ref: ref("plan", "Q1"),
      ticket: ref("plan", "C0-3"),
      title: "Compte AWS au nom du client. Estelle.",
      context: "**Compte AWS** au nom du client. Estelle.\n\nGroupe : Client — bloquants",
      blocking: true,
      answer: null,
    },
    {
      ref: ref("plan", "Q2"),
      ticket: ref("plan", "arbitrages"),
      title: "Charge : marge faible.",
      context: "**Charge** : marge faible.\n\nGroupe : Internes",
      blocking: true,
      answer: { text: "Résolue dans le plan Emis", at: "2026-10-06" },
    },
    {
      ref: ref("plan", "Q3"),
      ticket: ref("plan", "C1-2"),
      title: "Un seul bouton de connexion ? À confirmer.",
      context: "**Un seul bouton de connexion ?** À confirmer.\n\nGroupe : Internes",
      blocking: true,
      answer: { text: "Oui, un seul bouton.", at: "2026-10-06T10:00:00Z" },
    },
  ]);
});

test("unknown blocks go to Arbitrages, partial and open answers stay open, titles are cut at 200", () => {
  const long = "x".repeat(300);
  const edited = {
    ...plan,
    arbitrages: [
      {
        group: "G",
        tone: "info",
        items: [
          { ref: "Q7", blocks: "C9-9", resolved: false, question: long },
          { ref: "Q8", blocks: "C0-3", resolved: false, question: "Partielle ?" },
          { ref: "Q9", blocks: "C0-3", resolved: false, question: "Ouverte ?" },
        ],
      },
    ],
  };
  const out = desiredQuestions(edited, {
    Q8: { status: "partial", answer: "À moitié", at: "2026-10-01" },
    Q9: { status: "open", answer: "", at: "2026-10-01" },
  });
  expect(out.map((q) => [q.ref.id, q.ticket.id, q.answer])).toEqual([
    ["Q7", "arbitrages", null],
    ["Q8", "C0-3", null],
    ["Q9", "C0-3", null],
  ]);
  expect(out[0]?.title).toHaveLength(200);
});
