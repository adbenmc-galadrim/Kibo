import { describe, expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type NoteMeta, type Question } from "@kibo/schema";
import { detailExtras } from "./ticket-detail";

function question(id: string, extra: Partial<Question> = {}): Question {
  return {
    id,
    ticketId: "3",
    runId: null,
    title: `Question ${id}`,
    context: "",
    options: [],
    provisional: null,
    blocking: false,
    createdBy: { kind: "agent", ref: "livraison" },
    createdAt: 1,
    importRef: null,
    answer: null,
    recipient: "me",
    sentAt: null,
    history: [],
    archivedAt: null,
    archivedBy: null,
    ...extra,
  };
}

const answer = (deliveredAt: number | null) => ({
  kind: "text" as const,
  option: null,
  text: "oui",
  by: { kind: "human" as const, ref: "adam" },
  at: 2,
  deliveredAt,
  deliveredRunId: deliveredAt === null ? null : "run-1",
});

const note = (path: string, tickets: string[]): NoteMeta => ({
  path,
  title: path,
  mtime: 1,
  size: 1,
  tickets,
  links: [],
});

describe("ticket detail", () => {
  test("keeps open and undelivered questions, notes citing the key, and the plan brief", () => {
    const extras = detailExtras(
      { id: "3", key: "EMIS-3", planId: "C1-2" },
      {
        questions: [
          question("q1", { recipient: "client", blocking: true }),
          question("q2", { answer: answer(null) }),
          question("q3", { answer: answer(5) }),
          question("q4", { archivedAt: 3, archivedBy: { kind: "human", ref: "adam" } }),
          question("q5", { ticketId: "9" }),
          question("q6", { recipient: "ghost" }),
        ],
        questionRecipients: [...DEFAULT_RECIPIENTS],
      },
      {
        dir: "/notes",
        notes: [note("a.md", ["EMIS-3"]), note("briefs/C1-2.md", []), note("b.md", ["EMIS-4"])],
      },
    );
    expect(extras.questions).toEqual([
      {
        id: "q1",
        title: "Question q1",
        recipient: { id: "client", name: "Client" },
        state: "open",
        blocking: true,
      },
      {
        id: "q2",
        title: "Question q2",
        recipient: { id: "me", name: "Moi (technique)" },
        state: "answered",
        blocking: false,
      },
      {
        id: "q6",
        title: "Question q6",
        recipient: { id: "ghost", name: "ghost" },
        state: "open",
        blocking: false,
      },
    ]);
    expect(extras.notes).toEqual([{ path: "a.md", title: "a.md" }]);
    expect(extras.brief).toBe("/notes/briefs/C1-2.md");
  });

  test("no brief without a plan id or without the note", () => {
    const none = { questions: [], questionRecipients: [] };
    expect(detailExtras({ id: "3", key: "EMIS-3", planId: null }, none, { dir: "/n", notes: [] }).brief).toBe(
      null,
    );
    expect(
      detailExtras({ id: "3", key: "EMIS-3", planId: "C1-2" }, none, { dir: "/n", notes: [] }).brief,
    ).toBe(null);
  });
});
