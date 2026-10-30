import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  batchStatusOfResults,
  MEMORY_NOTE_PATH,
  RETIRED_ACTION_DETAIL,
  type RetiredAction,
} from "@kibo/schema";
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
const all = (actions: readonly { id: number }[]) => new Set(actions.map((a) => a.id));
const apply = (h: Harness, batch: Awaited<ReturnType<typeof propose>>, chosen = all(batch.actions)) =>
  applyBatch({ data: h.data, agents: () => h.agents }, batch, chosen, HUMAN);
const outcomes = (results: { outcome: string }[]) => results.map((r) => r.outcome);

describe("applyBatch", () => {
  test("applies a six action batch in order, feeding new: references to the next actions", async () => {
    const h = setup();
    const s = await seed(h);
    await h.data.writeNote(h.project.id, MEMORY_NOTE_PATH, "", "create");
    const batch = await propose(h, [
      { id: 1, why, type: "createTicket", ref: "new:1", title: "Nouveau", parent: "SILO-3" },
      { id: 2, why, type: "setStatus", ticket: "new:1", statusId: "in_progress" },
      { id: 3, why, type: "link", from: "SILO-1", to: "new:1", kind: "blocks" },
      { id: 4, why, type: "updateTicket", ticket: "SILO-2", title: "Deux renommé" },
      { id: 6, why, type: "answerQuestion", questionId: s.open.id, answer: { kind: "text", text: "8080" } },
      { id: 7, why, type: "updateNote", path: MEMORY_NOTE_PATH, content: "# Mémoire\n" },
    ]);
    const reads = h.projectReads();
    const results = await apply(h, batch);
    expect(h.projectReads() - reads).toBe(2);
    expect(outcomes(results)).toEqual(Array(6).fill("applied"));
    expect(results.map((r) => r.actionId)).toEqual([1, 2, 3, 4, 6, 7]);
    expect(batchStatusOfResults(results)).toBe("applied");
    const snap = h.data.project(h.project.id);
    const created = snap.tickets.find((t) => t.title === "Nouveau");
    expect(results[0]?.created).toEqual({ ticketId: created?.id ?? "", key: "SILO-10" });
    expect(created?.statusId).toBe("in_progress");
    expect(created?.parentId).toBe(s.tickets[2]?.id ?? "");
    expect(snap.links.some((l) => l.from === s.tickets[0]?.id && l.to === created?.id)).toBe(true);
    expect(titleOf(h, "SILO-2")).toBe("Deux renommé");
    const answered = snap.questions.find((q) => q.id === s.open.id);
    expect(answered?.answer?.by).toEqual(HUMAN);
    expect(await h.data.readNote(h.project.id, MEMORY_NOTE_PATH)).toBe("# Mémoire\n");
  });

  test("a failed createTicket skips its dependents and the batch goes on", async () => {
    const h = setup();
    await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "updateTicket", ticket: "SILO-2", title: "Avant le verrou" },
      { id: 2, why, type: "createTicket", ref: "new:1", title: "Nouveau" },
      { id: 3, why, type: "setStatus", ticket: "new:1", statusId: "in_progress" },
      { id: 4, why, type: "link", from: "new:1", to: "SILO-1", kind: "blocks" },
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
      { id: 1, why, type: "updateTicket", ticket: "SILO-1", title: "Non" },
      { id: 2, why, type: "setStatus", ticket: "SILO-2", statusId: "done" },
    ]);
    h.commands.length = 0;
    const results = await apply(h, batch, new Set([2]));
    expect(results[0]).toEqual({ actionId: 1, outcome: "skipped", detail: "décochée", created: null });
    expect(h.commands.map((c) => c.method)).toEqual(["setStatus"]);
    expect(titleOf(h, "SILO-1")).toBe("Ticket 1");
  });

  test("a note action goes through the notes", async () => {
    const h = setup();
    await seed(h);
    const batch = await propose(h, [{ id: 1, why, type: "createNote", path: MEMORY_NOTE_PATH, content: "" }]);
    expect(outcomes(await apply(h, batch))).toEqual(["applied"]);
    const dir = h.notes.info(h.project.id).dir;
    expect(readFileSync(join(dir, MEMORY_NOTE_PATH), "utf8")).toBe("");
  });
});

describe("stale targets are never overwritten", () => {
  test("a renamed ticket keeps its new title; a description change alone does not stale a title edit", async () => {
    const h = setup();
    const s = await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "updateTicket", ticket: "SILO-1", title: "Proposé" },
      { id: 2, why, type: "updateTicket", ticket: "SILO-2", title: "Proposé aussi" },
    ]);
    h.command({ method: "updateTicket", ticketId: s.tickets[0]?.id ?? "", title: "Changé par Adam" });
    h.command({ method: "updateTicket", ticketId: s.tickets[1]?.id ?? "", description: "Autre chose" });
    const results = await apply(h, batch);
    expect(outcomes(results)).toEqual(["stale", "applied"]);
    expect(results[0]?.detail).toContain("title");
    expect(titleOf(h, "SILO-1")).toBe("Changé par Adam");
    expect(titleOf(h, "SILO-2")).toBe("Proposé aussi");
  });

  test("status, question and notes changed since the proposal are stale", async () => {
    const h = setup();
    const s = await seed(h);
    await h.data.writeNote(h.project.id, "b.md", "# B\n", "create");
    const batch = await propose(h, [
      { id: 1, why, type: "setStatus", ticket: "SILO-3", statusId: "done" },
      { id: 2, why, type: "answerQuestion", questionId: s.open.id, answer: { kind: "text", text: "80" } },
      { id: 3, why, type: "updateNote", path: "a.md", content: "# Proposé\n" },
      { id: 4, why, type: "createNote", path: "c.md", content: "# C\n" },
    ]);
    h.command({ method: "setStatus", ticketId: s.tickets[2]?.id ?? "", statusId: "in_review" });
    h.command({
      method: "answerQuestion",
      questionId: s.open.id,
      answer: { kind: "text", text: "443" },
      by: HUMAN,
    });
    await h.data.writeNote(h.project.id, "a.md", "# Adam\n", "update");
    await h.data.writeNote(h.project.id, "c.md", "# Déjà là\n", "create");
    h.commands.length = 0;
    const results = await apply(h, batch);
    expect(outcomes(results)).toEqual(Array(4).fill("stale"));
    expect(h.commands).toEqual([]);
    expect(statusOf(h, "SILO-3")).toBe("in_review");
    expect(await h.data.readNote(h.project.id, "a.md")).toBe("# Adam\n");
    expect(await h.data.readNote(h.project.id, "c.md")).toBe("# Déjà là\n");
  });

  test("a ticket deleted since the proposal is stale", async () => {
    const h = setup();
    const s = await seed(h);
    const batch = await propose(h, [{ id: 1, why, type: "setStatus", ticket: "SILO-2", statusId: "done" }]);
    h.command({ method: "deleteTicket", ticketId: s.tickets[1]?.id ?? "" });
    expect(await apply(h, batch)).toEqual([
      { actionId: 1, outcome: "stale", detail: "ticket SILO-2 introuvable", created: null },
    ]);
  });
});

describe("applyBatch after a partial decision", () => {
  test("a new: reference resolves on the ticket created by an earlier decision, not on a skipped one", async () => {
    const h = setup();
    await seed(h);
    const batch = await propose(h, [
      { id: 1, why, type: "createTicket", ref: "new:1", title: "Nouveau" },
      { id: 2, why, type: "setStatus", ticket: "new:1", statusId: "in_progress" },
    ]);
    const first = await apply(h, batch, new Set([1]));
    const earlier = first.filter((r) => r.actionId === 1);
    const later = await apply(h, { ...batch, chosen: [1], results: earlier }, new Set([2]));
    expect(later.find((r) => r.actionId === 2)?.outcome).toBe("applied");
    expect(statusOf(h, earlier[0]?.created?.key ?? "")).toBe("in_progress");
    const skipped = earlier.map((r) => ({ ...r, outcome: "skipped" as const, created: null }));
    const none = await apply(h, { ...batch, results: skipped }, new Set([2]));
    expect(none.find((r) => r.actionId === 2)?.outcome).toBe("skipped");
  });
});

describe("retired actions", () => {
  test("a stored batch keeps its other actions and skips each retired one, even when checked", async () => {
    const h = setup();
    const s = await seed(h);
    const proposed = await propose(h, [
      { id: 2, why, type: "setStatus", ticket: "SILO-2", statusId: "done" },
    ]);
    const retired: RetiredAction[] = [
      { id: 1, why, type: "assignAgent", ticket: "SILO-3", profileId: "global:opus" },
      { id: 3, why, type: "deliverAnswers", ticket: "SILO-6" },
      { id: 4, why, type: "cancelRun", runId: s.runId },
      { id: 5, why, type: "dismissSignal", signal: "sig:1" },
    ];
    const batch = { ...proposed, actions: [...proposed.actions, ...retired] };
    h.commands.length = 0;
    const results = await apply(h, batch);
    expect(outcomes(results)).toEqual(["skipped", "applied", "skipped", "skipped", "skipped"]);
    for (const r of results.filter((x) => x.actionId !== 2))
      expect(r).toEqual({
        actionId: r.actionId,
        outcome: "skipped",
        detail: RETIRED_ACTION_DETAIL,
        created: null,
      });
    expect(h.commands.map((c) => c.method)).toEqual(["setStatus"]);
    expect(h.agents.cancelled).toEqual([]);
    expect(statusOf(h, "SILO-2")).toBe("done");
  });
});
