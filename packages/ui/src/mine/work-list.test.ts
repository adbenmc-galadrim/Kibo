import { describe, expect, test } from "bun:test";
import type { CiRun, ExternalRef, ProjectSnapshot, Question } from "@kibo/schema";
import { kib, mineSnapshots, mineTicket } from "./fixtures";
import { type WorkGroup, workList } from "./work-list";

const adam = { kind: "human" as const, ref: "adam" };
const pr = (number: number, review: "none" | "changes_requested" = "none"): ExternalRef => ({
  kind: "github_pr",
  number,
  state: "open",
  url: `https://github.com/silo-labs/silo-location/pull/${number}`,
  base: null,
  head: null,
  review,
  checks: null,
});

function project(questions: Question[] = []): ProjectSnapshot {
  const base = mineSnapshots.get(kib.id);
  if (!base) throw new Error("fixture kib missing");
  const rework = { ...mineTicket("KIB-45", "in_review", adam), externalRefs: [pr(20, "changes_requested")] };
  const broken = { ...mineTicket("KIB-46", "in_review", adam), externalRefs: [pr(21)] };
  const ready = { ...mineTicket("KIB-50", "todo", adam), startable: true };
  const asked = mineTicket("KIB-51", "todo", adam);
  return { ...base, tickets: [...base.tickets, rework, broken, ready, asked], questions };
}

const ciError = (prNumber: number): CiRun => ({
  repo: "silo-labs/silo-location",
  runId: 1,
  prNumber,
  ticketKey: "KIB-46",
  headSha: "abc1234",
  workflow: "ci",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/silo-labs/silo-location/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T10:00:00Z",
  jobs: [],
});

const blockingQuestion = (ticketId: string): Question => ({
  kind: "question",
  images: [],
  id: "q14",
  ticketId,
  runId: null,
  title: "Un box réaffecté garde-t-il ses photos ?",
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: 1,
  number: 14,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

const keys = (snapshot: ProjectSnapshot, runs: CiRun[] = []) =>
  workList([kib], new Map([[kib.id, snapshot]]), "adam", new Map([[kib.id, runs]])).map(
    (g): [WorkGroup, (string | null)[]] => [g.group, g.items.map((i) => i.ticket.key)],
  );

describe("my work list", () => {
  test("to fix, in progress, startable, then waiting; empty groups are left out", () => {
    expect(keys(project(), [ciError(21)])).toEqual([
      ["toFix", ["KIB-45", "KIB-46"]],
      ["inProgress", ["KIB-7", "KIB-11"]],
      ["startable", ["KIB-50"]],
      ["waiting", ["KIB-21", "KIB-15", "KIB-9", "KIB-51", "KIB-22"]],
    ]);
  });

  test("a broken CI without changes requested is to fix only once the run says so", () => {
    expect(keys(project())[0]).toEqual(["toFix", ["KIB-45"]]);
  });

  test("a merged PR with changes requested is not to fix", () => {
    const snapshot = project();
    const tickets = snapshot.tickets.map((t) =>
      t.key === "KIB-45"
        ? { ...t, externalRefs: [{ ...pr(20, "changes_requested"), state: "merged" as const }] }
        : t,
    );
    const items = workList([kib], new Map([[kib.id, { ...snapshot, tickets }]]), "adam", new Map()).flatMap(
      (g) => g.items,
    );
    expect(items.find((i) => i.ticket.key === "KIB-45")?.changes).toBe(false);
    expect(keys({ ...snapshot, tickets })[0]?.[0]).not.toBe("toFix");
  });

  test("an item carries its PR, its CI and the blocking question", () => {
    const snapshot = project();
    const asked = snapshot.tickets.find((t) => t.key === "KIB-51");
    if (!asked) throw new Error("fixture KIB-51 missing");
    const groups = workList(
      [kib],
      new Map([[kib.id, { ...snapshot, questions: [blockingQuestion(asked.id)] }]]),
      "adam",
      new Map(),
    );
    const items = groups.flatMap((g) => g.items);
    const rework = items.find((i) => i.ticket.key === "KIB-45");
    expect([rework?.pr?.number, rework?.changes]).toEqual([20, true]);
    expect(items.find((i) => i.ticket.key === "KIB-51")?.blockedBy).toBe("Q14");
  });

  test("a step on hold waits, even in review with changes requested or in progress", () => {
    const base = project();
    const hold = {
      source: "own" as const,
      key: "KIB-45",
      reason: "Accès VPN du client",
      since: "2026-10-16",
    };
    const held = new Set(["KIB-45", "KIB-7"]);
    const snapshot = {
      ...base,
      tickets: base.tickets.map((t) => (t.key !== null && held.has(t.key) ? { ...t, onHold: hold } : t)),
    };
    const groups = keys(snapshot);
    expect(groups.find(([g]) => g === "toFix")?.[1] ?? []).not.toContain("KIB-45");
    expect(groups.find(([g]) => g === "inProgress")?.[1] ?? []).not.toContain("KIB-7");
    expect(groups.find(([g]) => g === "waiting")?.[1]).toEqual(expect.arrayContaining(["KIB-45", "KIB-7"]));
  });
});
