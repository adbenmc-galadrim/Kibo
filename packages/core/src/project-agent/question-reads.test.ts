import { describe, expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type ProjectFingerprint } from "@kibo/schema";
import { diffFingerprints } from "./digest";
import { fingerprint } from "./fingerprint";
import { projectOverview, ticketSheet } from "./overview";
import { AGENTS, questionSnapshot } from "./test-kit";
import { listQuestions } from "./tools";

const snapshot = questionSnapshot();
const ids = (input: Parameters<typeof listQuestions>[1]) => listQuestions(snapshot, input).map((q) => q.id);

describe("list_questions", () => {
  test("open by default, archived on demand, all without the archived", () => {
    expect(ids({ state: "open" })).toEqual(["q1", "q5"]);
    expect(ids({ state: "answered" })).toEqual(["q2", "q3"]);
    expect(ids({ state: "archived" })).toEqual(["q4"]);
    expect(ids({ state: "all" })).toEqual(["q1", "q2", "q3", "q5"]);
  });

  test("filters by recipient, id or name, and refuses an unknown one", () => {
    expect(ids({ state: "all", recipient: "Client" })).toEqual(["q3"]);
    expect(ids({ state: "all", recipient: "me" })).toEqual(["q1", "q2", "q5"]);
    expect(() => ids({ state: "all", recipient: "Galadrim" })).toThrow(
      expect.objectContaining({
        code: "INVALID_INPUT",
        detail:
          "destinataire inconnu « Galadrim » ; destinataires du projet : Moi (technique), Produit, Client",
      }),
    );
  });

  test("a line tells the recipient, never a delivery", () => {
    expect(listQuestions(snapshot, { state: "answered" })).toEqual([
      {
        id: "q2",
        ticket: "SILO-1",
        title: "Deux",
        state: "answered",
        blocking: false,
        answer: "oui",
        recipient: "me",
        recipientName: "Moi (technique)",
        sentAt: null,
      },
      {
        id: "q3",
        ticket: "SILO-1",
        title: "Trois",
        state: "answered",
        blocking: false,
        answer: "oui",
        recipient: "client",
        recipientName: "Client",
        sentAt: null,
      },
    ]);
  });
});

describe("get_ticket and project_overview", () => {
  test("the sheet lists the questions with recipient and blocking, archived ones aside", () => {
    const [t1] = snapshot.tickets;
    if (!t1) throw new Error("fixture");
    expect(ticketSheet(snapshot, t1, []).questions).toEqual([
      {
        id: "q1",
        title: "A",
        state: "open",
        answer: null,
        recipient: "me",
        blocking: false,
      },
      {
        id: "q2",
        title: "Deux",
        state: "answered",
        answer: "oui",
        recipient: "me",
        blocking: false,
      },
      {
        id: "q3",
        title: "Trois",
        state: "answered",
        answer: "oui",
        recipient: "client",
        blocking: false,
      },
    ]);
  });

  test("the overview gives the recipients and the recipient of each open question", () => {
    const overview = projectOverview({
      project: snapshot,
      runs: [],
      queue: [],
      notes: [],
      agents: AGENTS,
      memory: "",
    });
    expect(overview.recipients).toEqual([...DEFAULT_RECIPIENTS]);
    expect(overview.openQuestions.map((q) => [q.id, q.recipient])).toEqual([
      ["q1", "me"],
      ["q5", "me"],
    ]);
  });
});

describe("question fingerprint and digest", () => {
  test("the fingerprint keeps state, title and recipient", () => {
    const fp = fingerprint({ project: snapshot, runs: [], notes: [] });
    expect(fp.questions.q3).toEqual({ state: "answered", title: "Trois", recipient: "client" });
    expect(fp.questions.q4).toEqual({ state: "archived", title: "Quatre", recipient: "me" });
    expect(fp.questions.q1).toEqual({ state: "open", title: "A", recipient: "me" });
  });

  const names = {
    ticket: (id: string) => id,
    question: () => "B",
    run: (id: string) => id,
    recipient: (id: string) => ({ client: "Client", galadrim: "Galadrim" })[id] ?? id,
  };
  const fp = (questions: ProjectFingerprint["questions"]): ProjectFingerprint => ({
    tickets: {},
    questions,
    runs: {},
    notes: {},
  });
  const texts = (before: ProjectFingerprint["questions"], after: ProjectFingerprint["questions"]) =>
    diffFingerprints(fp(before), fp(after), names).map((c) => c.text);
  const open = { state: "open" as const, title: "A", recipient: "client" };

  test("a renamed question and a new recipient", () => {
    expect(texts({ q1: open }, { q1: { ...open, title: "B" } })).toEqual([
      "Question modifiée : B (titre : « A » → « B »)",
    ]);
    expect(texts({ q1: open }, { q1: { ...open, recipient: "galadrim" } })).toEqual([
      "Destinataire de « B » : Client → Galadrim",
    ]);
  });

  test("reopened, archived and restored questions", () => {
    const done = { ...open, state: "answered" as const };
    const archived = { ...open, state: "archived" as const };
    expect(texts({ q1: done }, { q1: open })).toEqual(["Question rouverte : B"]);
    expect(texts({ q1: open }, { q1: archived })).toEqual(["Question archivée : B"]);
    expect(texts({ q1: archived }, { q1: open })).toEqual(["Question restaurée : B"]);
    expect(texts({ q1: open }, { q1: done })).toEqual(["Question répondue : B"]);
  });

  test("an old fingerprint still reads, without title nor recipient lines", () => {
    expect(texts({ q1: "open" }, { q1: { ...open, state: "answered", title: "Autre" } })).toEqual([
      "Question répondue : B",
    ]);
    expect(texts({ q1: "open" }, { q1: open })).toEqual([]);
  });
});
