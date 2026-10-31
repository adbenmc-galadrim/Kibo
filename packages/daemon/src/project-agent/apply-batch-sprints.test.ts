import { afterEach, describe, expect, test } from "bun:test";
import { type ProjectEventInput, type ProposedAction, Question, Sprint, type Ticket } from "@kibo/schema";
import { applyBatch } from "./apply-batch";
import { type Harness, HUMAN, harness, propose, questionOf } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

const why = "";
type Recorded = { projectId: string; event: ProjectEventInput };

function setup() {
  const h = harness();
  open.push(h);
  const sprint = (code: string, start: string, end: string) =>
    Sprint.parse(h.command({ method: "createSprint", code, name: `Sprint ${code}`, start, end }));
  const s42 = sprint("S42", "2026-10-12", "2026-10-16");
  const s43 = sprint("S43", "2026-10-19", "2026-10-23");
  const f5 = h.ticket("Rapports");
  const step = h.ticket("Étape");
  const f9 = h.ticket("Clôture");
  h.command({ method: "moveTicket", ticketId: step.id, parentId: f5.id });
  h.command({ method: "setTicketSprint", ticketId: f5.id, sprintId: s42.id });
  const recorded: Recorded[] = [];
  const events = {
    record: (projectId: string, event: ProjectEventInput) => recorded.push({ projectId, event }),
  };
  const apply = async (actions: ProposedAction[], before: () => void = () => undefined) => {
    const batch = await propose(h, actions);
    before();
    const chosen = new Set(actions.map((a) => a.id));
    return applyBatch({ data: h.data, agents: () => h.agents, events }, batch, chosen, HUMAN);
  };
  const sprintOf = (id: string) => h.data.project(h.project.id).tickets.find((t) => t.id === id)?.sprintId;
  return { h, s42, s43, f5, step, f9, recorded, apply, sprintOf };
}

const keyOf = (t: Ticket): string => t.key ?? "";

describe("sprint actions", () => {
  test("setSprint moves the feature by its sprint code, or out of the planning", async () => {
    const w = setup();
    const results = await w.apply([
      { id: 1, why, type: "setSprint", ticket: keyOf(w.f5), sprint: "S43" },
      { id: 2, why, type: "setSprint", ticket: keyOf(w.f9), sprint: null },
    ]);
    expect(results.map((r) => r.outcome)).toEqual(["applied", "applied"]);
    expect(w.sprintOf(w.f5.id)).toBe(w.s43.id);
    expect(w.h.commands.slice(-2)).toEqual([
      { method: "setTicketSprint", ticketId: w.f5.id, sprintId: w.s43.id },
      { method: "setTicketSprint", ticketId: w.f9.id, sprintId: null },
    ]);
  });

  test("a sprint created by the batch receives a feature later in the same batch", async () => {
    const w = setup();
    const results = await w.apply([
      {
        id: 1,
        why,
        type: "createSprint",
        code: "S45",
        name: "Clôture",
        start: "2026-11-02",
        end: "2026-11-06",
      },
      { id: 2, why, type: "setSprint", ticket: keyOf(w.f9), sprint: "S45" },
    ]);
    expect(results.map((r) => r.outcome)).toEqual(["applied", "applied"]);
    const s45 = w.h.data.project(w.h.project.id).sprints.find((s) => s.code === "S45");
    expect(s45).toMatchObject({ name: "Clôture", start: "2026-11-02", end: "2026-11-06" });
    expect(w.sprintOf(w.f9.id)).toBe(s45?.id ?? "");
  });

  test("a feature moved to another sprint since the proposal is stale and stays put", async () => {
    const w = setup();
    const moved = () => w.h.command({ method: "setTicketSprint", ticketId: w.f5.id, sprintId: w.s43.id });
    const results = await w.apply(
      [{ id: 1, why, type: "setSprint", ticket: keyOf(w.f5), sprint: null }],
      moved,
    );
    expect(results[0]).toMatchObject({
      outcome: "stale",
      detail: "modifié depuis la proposition : sprintId",
    });
    expect(w.sprintOf(w.f5.id)).toBe(w.s43.id);
  });

  test("remindQuestion records a reminded event and a journal entry on the feature", async () => {
    const w = setup();
    const q = Question.parse(
      w.h.command({
        method: "createQuestion",
        ticketId: w.step.id,
        title: "Format ?",
        createdBy: HUMAN,
        runId: null,
      }),
    );
    const results = await w.apply([{ id: 1, why, type: "remindQuestion", questionId: q.id }]);
    expect(results[0]?.outcome).toBe("applied");
    expect(questionOf(w.h, q.id)?.history).toEqual([
      { kind: "reminded", at: expect.any(Number), by: HUMAN, previous: {} },
    ]);
    expect(w.recorded).toEqual([
      {
        projectId: w.h.project.id,
        event: {
          kind: "question_reminded",
          ticketId: w.step.id,
          featureId: w.f5.id,
          source: "project-agent",
          data: { questionId: q.id, title: "Format ?" },
        },
      },
    ]);
  });

  test("a reminder that fails records nothing", async () => {
    const w = setup();
    const q = Question.parse(
      w.h.command({
        method: "createQuestion",
        ticketId: w.f9.id,
        title: "Date ?",
        createdBy: HUMAN,
        runId: null,
      }),
    );
    const answer = () =>
      w.h.command({
        method: "answerQuestion",
        questionId: q.id,
        answer: { kind: "text", text: "lundi" },
        by: HUMAN,
      });
    const results = await w.apply([{ id: 1, why, type: "remindQuestion", questionId: q.id }], answer);
    expect(results[0]?.outcome).toBe("stale");
    expect(w.recorded).toEqual([]);
  });
});
