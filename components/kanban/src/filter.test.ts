import { expect, test } from "bun:test";
import type { CiRun, GithubPrRef, Sprint, TicketView } from "@kibo/schema";
import { EMPTY_PROGRESS } from "@kibo/schema";
import fc from "fast-check";
import { filterTickets, inMode, labelFilterOf, projectLabels, toFix } from "./filter";
import { ticketPr } from "./ticket-pr";

const t = (
  key: string,
  assignee: TicketView["assignee"],
  labels: string[] = [],
  children = 0,
): TicketView => ({
  id: key,
  key,
  pendingSeq: null,
  keyLabel: key,
  title: key,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee,
  parentId: null,
  labels,
  externalRefs: [],
  progress: { done: 0, total: children },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
});

test("'mine and agents' keeps my tickets and every agent ticket", () => {
  const all = [
    t("KIB-1", { kind: "human", ref: "adam" }),
    t("KIB-2", { kind: "human", ref: "lea" }),
    t("KIB-3", { kind: "agent", ref: "opus-dev-1" }),
    t("KIB-4", null),
  ];
  expect(filterTickets(all, "mine-and-agents", "adam").map((x) => x.key)).toEqual(["KIB-1", "KIB-3"]);
  expect(filterTickets(all, "all", "adam")).toHaveLength(4);
});

test("the label filter keeps the tickets carrying it and combines with 'mine and agents'", () => {
  const all = [
    t("KIB-1", { kind: "human", ref: "adam" }, ["area:api"]),
    t("KIB-2", { kind: "human", ref: "lea" }, ["area:api", "phase:p1"]),
    t("KIB-3", { kind: "agent", ref: "opus-dev-1" }, ["phase:p1"]),
    t("KIB-4", null),
  ];
  expect(filterTickets(all, "all", "adam", "area:api").map((x) => x.key)).toEqual(["KIB-1", "KIB-2"]);
  expect(filterTickets(all, "all", "adam", null)).toHaveLength(4);
  expect(filterTickets(all, "mine-and-agents", "adam", "phase:p1").map((x) => x.key)).toEqual(["KIB-3"]);
  expect(filterTickets(all, "all", "adam", "gone")).toEqual([]);
  expect(projectLabels(all)).toEqual(["area:api", "phase:p1"]);
});

test("the saved label filter reads back only a label, '*' and anything else mean all", () => {
  expect(labelFilterOf("area:api")).toBe("area:api");
  expect(labelFilterOf("*")).toBeNull();
  expect(labelFilterOf(undefined)).toBeNull();
  expect(labelFilterOf(42)).toBeNull();
  expect(labelFilterOf("Pas Valide")).toBeNull();
});

test("a label filter only ever narrows the board", () => {
  const label = fc.stringMatching(/^[a-z]{1,2}(:[a-z]{1,2})?$/);
  fc.assert(
    fc.property(fc.array(fc.array(label, { maxLength: 3 }), { maxLength: 6 }), label, (sets, chosen) => {
      const all = sets.map((ls, i) => t(`KIB-${i}`, null, ls));
      const kept = filterTickets(all, "all", "adam", chosen);
      return kept.every((x) => x.labels.includes(chosen)) && kept.length <= all.length;
    }),
  );
});

test("a group of tickets never gets a card, whatever the filter", () => {
  const all = [t("KIB-1", null, [], 2), t("KIB-2", null), t("KIB-3", { kind: "agent", ref: "opus" }, [], 1)];
  expect(filterTickets(all, "all", "adam").map((x) => x.key)).toEqual(["KIB-2"]);
  expect(filterTickets(all, "mine-and-agents", "adam")).toEqual([]);
});

const pr = (number: number, over: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: `https://github.com/galadrim/emis/pull/${number}`,
  number,
  state: "open",
  base: null,
  head: null,
  review: "none",
  checks: null,
  ...over,
});
const withRefs = (key: string, refs: GithubPrRef[]): TicketView => ({ ...t(key, null), externalRefs: refs });
const ci = (prNumber: number, conclusion: string | null): CiRun => ({
  repo: "galadrim/emis",
  runId: prNumber * 10,
  prNumber,
  ticketKey: "EMIS-45",
  headSha: "abc",
  workflow: "CI",
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
  url: "https://github.com/galadrim/emis/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T10:00:00Z",
  jobs: [],
});

test("the PR of a ticket is its live PR, else its latest one", () => {
  expect(ticketPr(t("EMIS-1", null))).toBeNull();
  expect(ticketPr(withRefs("EMIS-1", [pr(3, { state: "merged" }), pr(2)]))?.number).toBe(2);
  expect(ticketPr(withRefs("EMIS-1", [pr(3, { state: "merged" }), pr(5, { state: "closed" })]))?.number).toBe(
    5,
  );
});

test("a ticket is to fix when its live PR has changes requested or a broken CI", () => {
  expect(toFix(withRefs("EMIS-45", [pr(20, { review: "changes_requested" })]), [])).toBe(true);
  expect(toFix(withRefs("EMIS-45", [pr(20, { checks: "error" })]), [])).toBe(true);
  expect(toFix(withRefs("EMIS-45", [pr(20, { checks: "ok" })]), [ci(20, "failure")])).toBe(true);
  expect(toFix(withRefs("EMIS-45", [pr(20, { checks: "error" })]), [ci(20, "success")])).toBe(false);
  expect(toFix(withRefs("EMIS-45", [pr(20, { review: "approved", checks: "ok" })]), [])).toBe(false);
  expect(toFix(withRefs("EMIS-45", [pr(20, { state: "merged", review: "changes_requested" })]), [])).toBe(
    false,
  );
  expect(toFix(t("EMIS-45", null), [ci(20, "failure")])).toBe(false);
});

test("the board modes: every ticket, the current sprint, or the tickets to fix", () => {
  const sprints: Sprint[] = [{ id: "S42", code: "S42", name: "S42", start: "2026-10-12", end: "2026-10-16" }];
  const facts = { sprints, today: "2026-10-17", ciRuns: [] };
  const inSprint = { ...t("EMIS-1", null), effectiveSprintId: "S42" };
  const broken = withRefs("EMIS-45", [pr(20, { checks: "error" })]);
  expect([inSprint, broken].filter((x) => inMode(x, "all", facts))).toHaveLength(2);
  expect([inSprint, broken].filter((x) => inMode(x, "sprint", facts))).toEqual([inSprint]);
  expect([inSprint, broken].filter((x) => inMode(x, "toFix", facts))).toEqual([broken]);
});
