import { expect, test } from "bun:test";
import type { GithubPrRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { question, siloSnapshot, TODAY, ticket } from "./today-fixtures";
import { todayModel } from "./today-model";

const pr = (number: number, p: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: `https://github.com/silo-labs/silo/pull/${number}`,
  number,
  state: "open",
  base: null,
  head: null,
  review: "none",
  checks: null,
  ...p,
});

const project = (key: string, tickets: TicketView[], p: Partial<ProjectSnapshot> = {}): ProjectSnapshot => {
  const base = siloSnapshot();
  return {
    ...base,
    meta: { ...base.meta, id: key.toLowerCase(), key, name: key, client: null, folder: null },
    tickets,
    questions: [],
    links: [],
    sprints: [],
    ...p,
  };
};

const keysOf = (rows: readonly { ticket: { keyLabel: string } }[]) => rows.map((r) => r.ticket.keyLabel);

test("blocking lists blocking questions first then blocked tickets, by project then key", () => {
  const atlas = project(
    "ATL",
    [
      ticket({ id: "a2", key: "ATL-2", title: "Deux", statusId: "blocked" }),
      ticket({ id: "a10", key: "ATL-10", title: "Dix" }),
      ticket({ id: "a9", key: "ATL-9", title: "Neuf" }),
    ],
    {
      questions: [question({ id: "q1", ticketId: "a10" }), question({ id: "q2", ticketId: "a9", number: 2 })],
    },
  );
  const kibo = project("KIB", [
    ticket({ id: "k1", key: "KIB-1", title: "Un", statusId: "blocked", blockedReason: "serveur" }),
  ]);
  const { blocking, blockingQuestions } = todayModel([atlas, kibo], TODAY);
  expect(keysOf(blocking)).toEqual(["ATL-9", "ATL-10", "ATL-2", "KIB-1"]);
  expect(blockingQuestions).toBe(2);
  expect(blocking[0]?.reason).toEqual({ kind: "question", label: "Q2", feature: null, detail: null });
  expect(blocking[3]?.reason).toEqual({ kind: "status", detail: "serveur" });
});

test("a blocking question names the feature it holds back and the reason of a blocked ticket", () => {
  const silo = project(
    "SILO",
    [
      ticket({ id: "f6", key: "F6", shortKey: "F6", title: "Importer", progress: { done: 0, total: 2 } }),
      ticket({ id: "s1", key: "SILO-51", title: "Lecture", parentId: "f6" }),
      ticket({ id: "s2", key: "SILO-52", title: "Attente", statusId: "blocked", blockedReason: "le client" }),
    ],
    { questions: [question({ id: "q", ticketId: "s1" }), question({ id: "r", ticketId: "s2", number: 15 })] },
  );
  const { blocking } = todayModel([silo], TODAY);
  expect(blocking.map((b) => b.reason)).toEqual([
    { kind: "question", label: "Q14", feature: "F6", detail: null },
    { kind: "question", label: "Q15", feature: null, detail: "le client" },
  ]);
});

test("prsToReview puts requested changes first then oldest", () => {
  const silo = project("SILO", [
    ticket({ id: "a", key: "SILO-1", title: "A", externalRefs: [pr(22, { checks: "ok" })] }),
    ticket({ id: "b", key: "SILO-2", title: "B", externalRefs: [pr(30, { review: "changes_requested" })] }),
    ticket({ id: "c", key: "SILO-3", title: "C", externalRefs: [pr(23, { checks: "running" })] }),
    ticket({ id: "d", key: "SILO-4", title: "D", externalRefs: [pr(9, { state: "merged" })] }),
    ticket({ id: "e", key: "SILO-5", title: "E", externalRefs: [pr(24, { checks: "error" })] }),
  ]);
  const { prsToReview } = todayModel([silo], TODAY);
  expect(prsToReview.map((p) => [p.pr.number, p.state])).toEqual([
    [30, "changes"],
    [22, "ci-ok"],
    [23, "ci-running"],
    [24, "review"],
  ]);
});

test("a pull request shared by two steps of a project gets one line", () => {
  const silo = project("SILO", [
    ticket({ id: "a", key: "SILO-1", title: "A", externalRefs: [pr(22)] }),
    ticket({ id: "b", key: "SILO-2", title: "B", externalRefs: [pr(22)] }),
  ]);
  expect(todayModel([silo], TODAY).prsToReview.map((p) => p.ticket.keyLabel)).toEqual(["SILO-1"]);
});

test("startable keeps only startable steps, current sprint first", () => {
  const base = siloSnapshot();
  const silo = project(
    "SILO",
    [
      ticket({
        id: "f",
        key: "F4",
        shortKey: "F4",
        title: "Saisir",
        progress: { done: 0, total: 3 },
        startable: true,
      }),
      ticket({ id: "a", key: "SILO-9", title: "Hors sprint", startable: true }),
      ticket({
        id: "b",
        key: "SILO-46",
        title: "Démo",
        parentId: "f",
        startable: true,
        effectiveSprintId: "s42",
      }),
      ticket({ id: "c", key: "SILO-47", title: "Pas encore", parentId: "f" }),
    ],
    { sprints: base.sprints, links: [{ id: "l", from: "c", to: "a", type: "blocks" }] },
  );
  const { startable } = todayModel([silo], TODAY);
  expect(keysOf(startable)).toEqual(["SILO-46", "SILO-9"]);
  expect(startable[0]?.feature).toEqual({ label: "F4", title: "Saisir" });
  expect(startable[1]?.feature).toBeNull();
  expect(startable.map((s) => s.free)).toEqual([true, false]);
});

test("projects carry delivered/total, open, blocked, at-risk and the current sprint", () => {
  const silo = siloSnapshot();
  const [row] = todayModel([silo], TODAY).projects;
  expect(row).toMatchObject({
    id: "silo",
    key: "SILO",
    client: "Silo SA",
    progress: { done: 0, total: 1 },
    open: 7,
    blocked: 5,
    risk: 0,
    sprint: "S42",
  });
});

test("a project without features counts its tickets, a new one has no progress", () => {
  const atlas = project("ATL", [
    ticket({ id: "a", key: "ATL-1", title: "A", statusId: "done" }),
    ticket({ id: "b", key: "ATL-2", title: "B" }),
  ]);
  const [withTickets, fresh] = todayModel([atlas, project("NIM", [])], TODAY).projects;
  expect(withTickets?.progress).toEqual({ done: 1, total: 2 });
  expect(fresh?.progress).toBeNull();
});

test("counts use the daemon day and open = not done", () => {
  const silo = siloSnapshot();
  const atlas = project("ATL", [
    ticket({ id: "a", key: "ATL-1", title: "A", statusId: "done" }),
    ticket({ id: "b", key: "ATL-2", title: "B" }),
  ]);
  const during = todayModel([silo, atlas], "2026-10-14");
  expect(during).toMatchObject({ date: "2026-10-14", projectCount: 2, openTickets: 8 });
  expect(during.projects[0]?.sprint).toBe("S42");
  expect(todayModel([silo], "2026-10-20").projects[0]?.sprint).toBe("S43");
});
