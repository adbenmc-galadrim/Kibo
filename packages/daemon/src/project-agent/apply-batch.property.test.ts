import { describe, expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import fc from "fast-check";
import { applyBatch } from "./apply-batch";
import {
  type Harness,
  HUMAN,
  harness,
  propose,
  type Seeded,
  seed,
  statusOf,
  titleOf,
} from "./fakes.test-helper";

const why = "";

async function withHarness<T>(fn: (h: Harness, s: Seeded) => Promise<T>): Promise<T> {
  const h = harness();
  try {
    return await fn(h, await seed(h));
  } finally {
    h.close();
  }
}

const apply = (h: Harness, batch: Awaited<ReturnType<typeof propose>>, chosen: ReadonlySet<number>) =>
  applyBatch({ data: h.data, agents: () => h.agents }, batch, chosen, HUMAN);

const mutation = fc.record({
  renameFirst: fc.boolean(),
  moveSecond: fc.boolean(),
  editNote: fc.boolean(),
  answerQuestion: fc.boolean(),
  noise: fc.boolean(),
});

describe("executor properties", () => {
  test("a target modified between proposal and validation is stale and keeps its value", async () => {
    await fc.assert(
      fc.asyncProperty(mutation, (m) =>
        withHarness(async (h, s) => {
          const [t1, t2, t3] = [s.tickets[0]?.id ?? "", s.tickets[1]?.id ?? "", s.tickets[2]?.id ?? ""];
          const batch = await propose(h, [
            { id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "Proposé" },
            { id: 2, why, type: "setStatus", ticket: "EMIS-2", statusId: "done" },
            { id: 3, why, type: "updateNote", path: "a.md", content: "# Proposé\n" },
            {
              id: 4,
              why,
              type: "answerQuestion",
              questionId: s.open.id,
              answer: { kind: "text", text: "Proposé" },
            },
          ]);
          if (m.renameFirst) h.command({ method: "updateTicket", ticketId: t1, title: "Adam" });
          if (m.moveSecond) h.command({ method: "setStatus", ticketId: t2, statusId: "in_review" });
          if (m.editNote) await h.data.writeNote(h.project.id, "a.md", "# Adam\n", "update");
          if (m.answerQuestion)
            h.command({
              method: "answerQuestion",
              questionId: s.open.id,
              answer: { kind: "text", text: "Adam" },
              by: HUMAN,
            });
          if (m.noise) {
            h.command({ method: "updateTicket", ticketId: t1, description: "bruit" });
            h.command({ method: "updateTicket", ticketId: t3, title: "Bruit" });
          }
          const results = await apply(h, batch, new Set([1, 2, 3, 4]));
          const flags = [m.renameFirst, m.moveSecond, m.editNote, m.answerQuestion];
          expect(results.map((r) => r.outcome)).toEqual(flags.map((f) => (f ? "stale" : "applied")));
          expect(titleOf(h, "EMIS-1")).toBe(m.renameFirst ? "Adam" : "Proposé");
          expect(statusOf(h, "EMIS-2")).toBe(m.moveSecond ? "in_review" : "done");
          expect(await h.data.readNote(h.project.id, "a.md")).toBe(m.editNote ? "# Adam\n" : "# Proposé\n");
          const answer = h.data.project(h.project.id).questions.find((q) => q.id === s.open.id)?.answer;
          expect(answer?.text).toBe(m.answerQuestion ? "Adam" : "Proposé");
        }),
      ),
      { numRuns: 20 },
    );
  });

  test("an unchecked action writes nothing", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    await fc.assert(
      fc.asyncProperty(fc.subarray(ids), (picked) =>
        withHarness(async (h, s) => {
          const [t8, t9] = [s.tickets[7]?.id ?? "", s.tickets[8]?.id ?? ""];
          h.command({ method: "addLink", from: t8, to: t9, type: "blocks" });
          const actions: ProposedAction[] = [
            { id: 1, why, type: "createTicket", ref: "new:1", title: "Créé" },
            { id: 2, why, type: "updateTicket", ticket: "EMIS-1", title: "Renommé" },
            { id: 3, why, type: "setStatus", ticket: "EMIS-2", statusId: "done" },
            { id: 4, why, type: "link", from: "EMIS-3", to: "EMIS-4", kind: "blocks" },
            { id: 5, why, type: "assignAgent", ticket: "EMIS-5", profileId: "opus" },
            { id: 6, why, type: "deliverAnswers", ticket: "EMIS-6" },
            { id: 7, why, type: "cancelRun", runId: s.runId },
            {
              id: 8,
              why,
              type: "answerQuestion",
              questionId: s.open.id,
              answer: { kind: "text", text: "Oui" },
            },
            { id: 9, why, type: "createQuestion", ticket: "EMIS-7", title: "Nouvelle question ?" },
            { id: 10, why, type: "createNote", path: "b.md", content: "# B\n" },
            { id: 11, why, type: "updateNote", path: "a.md", content: "# A bis\n" },
            { id: 12, why, type: "unlink", from: "EMIS-8", to: "EMIS-9", kind: "blocks" },
          ];
          const batch = await propose(h, actions);
          h.commands.length = 0;
          const chosen = new Set(picked);
          const results = await apply(h, batch, chosen);
          for (const r of results) {
            if (chosen.has(r.actionId)) expect(r.outcome).toBe("applied");
            else
              expect(r).toEqual({
                actionId: r.actionId,
                outcome: "skipped",
                detail: "décochée",
                created: null,
              });
          }
          const commandIds = [1, 2, 3, 4, 8, 9, 12];
          expect(h.commands).toHaveLength(commandIds.filter((id) => chosen.has(id)).length);
          expect(h.agents.assigned).toHaveLength(chosen.has(5) ? 1 : 0);
          expect(h.agents.delivered).toHaveLength(chosen.has(6) ? 1 : 0);
          expect(h.agents.cancelled).toHaveLength(chosen.has(7) ? 1 : 0);
          const snap = h.data.project(h.project.id);
          expect(snap.tickets.some((t) => t.title === "Créé")).toBe(chosen.has(1));
          expect(titleOf(h, "EMIS-1")).toBe(chosen.has(2) ? "Renommé" : "Ticket 1");
          expect(snap.links.some((l) => l.from === t8 && l.to === t9)).toBe(!chosen.has(12));
          expect(await h.data.readNote(h.project.id, "b.md")).toBe(chosen.has(10) ? "# B\n" : null);
          expect(await h.data.readNote(h.project.id, "a.md")).toBe(chosen.has(11) ? "# A bis\n" : "# A\n");
        }),
      ),
      { numRuns: 20 },
    );
  });
});
