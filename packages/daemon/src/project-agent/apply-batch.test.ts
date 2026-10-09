import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  batchStatusOfResults,
  KiboError,
  MEMORY_NOTE_PATH,
  type ProposedAction,
  Question,
} from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { applyBatch } from "./apply-batch";
import {
  type Harness,
  HUMAN,
  harness,
  propose,
  readOnly,
  seed,
  statusOf,
  titleOf,
} from "./fakes.test-helper";

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
  applyBatch({ data: h.data, agents: () => h.agents }, batch, chosen, HUMAN);
const outcomes = (results: { outcome: string }[]) => results.map((r) => r.outcome);

describe("applyBatch", () => {
  test("applies a seven action batch in order, feeding new: references to the next actions", async () => {
    const h = setup();
    const s = await seed(h);
    await h.data.writeNote(h.project.id, MEMORY_NOTE_PATH, "", "create");
    const batch = await propose(h, [
      { id: 1, why, type: "createTicket", ref: "new:1", title: "Nouveau", parent: "EMIS-3" },
      { id: 2, why, type: "setStatus", ticket: "new:1", statusId: "in_progress" },
      { id: 3, why, type: "link", from: "EMIS-1", to: "new:1", kind: "blocks" },
      { id: 4, why, type: "updateTicket", ticket: "EMIS-2", title: "Deux renommé" },
      { id: 5, why, type: "assignAgent", ticket: "new:1", profileId: "opus", brief: "Vas-y" },
      { id: 6, why, type: "answerQuestion", questionId: s.open.id, answer: { kind: "text", text: "8080" } },
      { id: 7, why, type: "updateNote", path: MEMORY_NOTE_PATH, content: "# Mémoire\n" },
    ]);
    const reads = h.projectReads();
    const results = await apply(h, batch);
    expect(h.projectReads() - reads).toBe(2);
    expect(outcomes(results)).toEqual(Array(7).fill("applied"));
    expect(results.map((r) => r.actionId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(batchStatusOfResults(results)).toBe("applied");
    const snap = h.data.project(h.project.id);
    const created = snap.tickets.find((t) => t.title === "Nouveau");
    expect(results[0]?.created).toEqual({ ticketId: created?.id ?? "", key: "EMIS-10" });
    expect(created?.statusId).toBe("in_progress");
    expect(created?.parentId).toBe(s.tickets[2]?.id ?? "");
    expect(snap.links.some((l) => l.from === s.tickets[0]?.id && l.to === created?.id)).toBe(true);
    expect(titleOf(h, "EMIS-2")).toBe("Deux renommé");
    expect(h.agents.assigned).toEqual([
      { projectId: h.project.id, ticketId: created?.id ?? "", profileId: "opus", brief: "Vas-y" },
    ]);
    const answered = snap.questions.find((q) => q.id === s.open.id);
    expect(answered?.answer?.by).toEqual(HUMAN);
    expect(await h.data.readNote(h.project.id, MEMORY_NOTE_PATH)).toBe("# Mémoire\n");
  });

  test("a failed createTicket skips its dependents and the batch goes on", async () => {
    const h = setup();
    await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "updateTicket", ticket: "EMIS-2", title: "Avant le verrou" },
      { id: 2, why, type: "createTicket", ref: "new:1", title: "Nouveau" },
      { id: 3, why, type: "setStatus", ticket: "new:1", statusId: "in_progress" },
      { id: 4, why, type: "link", from: "new:1", to: "EMIS-1", kind: "blocks" },
      { id: 5, why, type: "updateNote", path: "a.md", content: "# A bis\n" },
    ]);
    const data = {
      ...h.data,
      runCommand: (projectId: string, command: Parameters<typeof h.data.runCommand>[1]) => {
        const out = h.data.runCommand(projectId, command);
        readOnly(h);
        return out;
      },
    };
    const results = await applyBatch({ data, agents: () => h.agents }, batch, all(batch.actions), HUMAN);
    expect(outcomes(results)).toEqual(["applied", "failed", "skipped", "skipped", "applied"]);
    expect(results[1]?.detail).toContain("read-only");
    expect(results[2]?.detail).toBe("dépend de new:1 (échouée)");
    expect(results[3]?.detail).toBe("dépend de new:1 (échouée)");
    expect(batchStatusOfResults(results)).toBe("partial");
  });

  test("an unchecked action is skipped and sends no command", async () => {
    const h = setup();
    await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "Non" },
      { id: 2, why, type: "setStatus", ticket: "EMIS-2", statusId: "done" },
    ]);
    h.commands.length = 0;
    const results = await apply(h, batch, new Set([2]));
    expect(results[0]).toEqual({ actionId: 1, outcome: "skipped", detail: "décochée", created: null });
    expect(h.commands.map((c) => c.method)).toEqual(["setStatus"]);
    expect(titleOf(h, "EMIS-1")).toBe("Ticket 1");
  });

  test("an orchestrator refusal fails the action with its message", async () => {
    const h = setup();
    await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "assignAgent", ticket: "EMIS-3", profileId: "opus" },
    ]);
    h.agents.failAssign = new KiboError("CONFLICT", "ticket already has an active run");
    const results = await apply(h, batch);
    expect(results).toEqual([
      { actionId: 1, outcome: "failed", detail: "ticket already has an active run", created: null },
    ]);
  });

  test("agents and notes actions go through the orchestrator and the notes", async () => {
    const h = setup();
    const s = await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "cancelRun", runId: s.runId },
      { id: 2, why, type: "deliverAnswers", ticket: "EMIS-6" },
      { id: 3, why, type: "createNote", path: MEMORY_NOTE_PATH, content: "" },
    ]);
    expect(outcomes(await apply(h, batch))).toEqual(["applied", "applied", "applied"]);
    expect(h.agents.cancelled).toEqual([s.runId]);
    expect(h.agents.delivered).toEqual([{ projectId: h.project.id, ticketId: s.tickets[5]?.id ?? "" }]);
    const dir = h.notes.info(h.project.id).dir;
    expect(readFileSync(join(dir, MEMORY_NOTE_PATH), "utf8")).toBe("");
  });
});

describe("stale targets are never overwritten", () => {
  test("a renamed ticket keeps its new title; a description change alone does not stale a title edit", async () => {
    const h = setup();
    const s = await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "Proposé" },
      { id: 2, why, type: "updateTicket", ticket: "EMIS-2", title: "Proposé aussi" },
    ]);
    h.command({ method: "updateTicket", ticketId: s.tickets[0]?.id ?? "", title: "Changé par Adam" });
    h.command({ method: "updateTicket", ticketId: s.tickets[1]?.id ?? "", description: "Autre chose" });
    const results = await apply(h, batch);
    expect(outcomes(results)).toEqual(["stale", "applied"]);
    expect(results[0]?.detail).toContain("title");
    expect(titleOf(h, "EMIS-1")).toBe("Changé par Adam");
    expect(titleOf(h, "EMIS-2")).toBe("Proposé aussi");
  });

  test("status, question, notes, runs and answers changed since the proposal are stale", async () => {
    const h = setup();
    const s = await seed(h);
    await h.data.writeNote(h.project.id, "b.md", "# B\n", "create");
    const batch = await propose(h, [
      { id: 1, why, type: "setStatus", ticket: "EMIS-3", statusId: "done" },
      { id: 2, why, type: "answerQuestion", questionId: s.open.id, answer: { kind: "text", text: "80" } },
      { id: 3, why, type: "updateNote", path: "a.md", content: "# Proposé\n" },
      { id: 4, why, type: "createNote", path: "c.md", content: "# C\n" },
      { id: 5, why, type: "cancelRun", runId: s.runId },
      { id: 6, why, type: "deliverAnswers", ticket: "EMIS-6" },
      { id: 7, why, type: "assignAgent", ticket: "EMIS-4", profileId: "opus" },
    ]);
    const [t3, t4, t6] = [s.tickets[2]?.id ?? "", s.tickets[3]?.id ?? "", s.tickets[5]?.id ?? ""];
    h.command({ method: "setStatus", ticketId: t3, statusId: "in_review" });
    h.command({
      method: "answerQuestion",
      questionId: s.open.id,
      answer: { kind: "text", text: "443" },
      by: HUMAN,
    });
    await h.data.writeNote(h.project.id, "a.md", "# Adam\n", "update");
    await h.data.writeNote(h.project.id, "c.md", "# Déjà là\n", "create");
    h.agents.runs[0] = { ...(h.agents.runs[0] ?? runView({ id: s.runId })), state: "done" };
    const extra = Question.parse(
      h.command({ method: "createQuestion", ticketId: t6, title: "Autre ?", createdBy: HUMAN, runId: null }),
    );
    h.command({
      method: "answerQuestion",
      questionId: extra.id,
      answer: { kind: "text", text: "oui" },
      by: HUMAN,
    });
    h.agents.runs.push(runView({ id: "r9", projectId: h.project.id, ticketId: t4, state: "queued" }));
    h.commands.length = 0;
    const results = await apply(h, batch);
    expect(outcomes(results)).toEqual(Array(7).fill("stale"));
    expect(h.commands).toEqual([]);
    expect(h.agents.cancelled).toEqual([]);
    expect(h.agents.delivered).toEqual([]);
    expect(h.agents.assigned).toEqual([]);
    expect(statusOf(h, "EMIS-3")).toBe("in_review");
    expect(await h.data.readNote(h.project.id, "a.md")).toBe("# Adam\n");
    expect(await h.data.readNote(h.project.id, "c.md")).toBe("# Déjà là\n");
  });

  test("a ticket deleted since the proposal is stale", async () => {
    const h = setup();
    const s = await seed(h);
    const batch = await propose(h, [{ id: 1, why, type: "setStatus", ticket: "EMIS-2", statusId: "done" }]);
    h.command({ method: "deleteTicket", ticketId: s.tickets[1]?.id ?? "" });
    expect(await apply(h, batch)).toEqual([
      { actionId: 1, outcome: "stale", detail: "ticket EMIS-2 introuvable", created: null },
    ]);
  });
});
