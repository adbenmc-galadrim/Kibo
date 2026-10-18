import { describe, expect, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ExternalRef,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { lookupTicket, matchesStatus, normalizedStatus, statusFilter, summarize } from "./ticket-view";

function ticket(
  id: string,
  statusId: StatusId,
  extra: { parentId?: string; refs?: ExternalRef[] } = {},
): TicketView {
  return {
    id,
    key: `EMIS-${id}`,
    pendingSeq: null,
    title: `Ticket ${id}`,
    description: `Description ${id}`,
    statusId,
    blockedReason: statusId === "blocked" ? "attente" : null,
    domainId: null,
    assignee: null,
    parentId: extra.parentId ?? null,
    externalRefs: extra.refs ?? [],
    labels: [],
    agentProgress: EMPTY_PROGRESS,
    delivery: null,
    sprintId: null,
    optional: false,
    shortKey: null,
    effectiveSprintId: null,
    session: null,
    updatedAt: null,
    feature: null,
    progress: { done: 0, total: 0 },
    waitingOn: [],
    keyLabel: `EMIS-${id}`,
    openQuestions: 0,
    startable: true,
    startReason: null,
  };
}

const plan = (id: string): ExternalRef => ({ kind: "import_ref", source: "plan", id });
const pr = (number: number, state: "open" | "draft" | "merged" | "closed"): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/o/r/pull/${number}`,
  number,
  state,
  base: null,
  head: null,
  review: "none",
  checks: null,
});

const snapshot = {
  workflow: DEFAULT_WORKFLOW,
  tickets: [
    ticket("1", "todo", { refs: [plan("C1")] }),
    ticket("2", "done", { parentId: "1", refs: [plan("C1-1"), pr(4, "merged")] }),
    ticket("3", "todo", { parentId: "1", refs: [plan("C1-2"), pr(5, "closed"), pr(7, "open")] }),
    ticket("4", "in_review", { refs: [plan("C1-3")] }),
    ticket("5", "todo"),
    ticket("6", "blocked"),
  ],
  links: [
    { id: "l1", from: "2", to: "3", type: "blocks" as const },
    { id: "l2", from: "4", to: "5", type: "blocks" as const },
    { id: "l3", from: "6", to: "3", type: "relates" as const },
  ],
  sprints: [],
};

describe("ticket view", () => {
  test("normalizes every Kibo status", () => {
    const all = DEFAULT_WORKFLOW.map((s) => [s.id, normalizedStatus(s.id)]);
    expect(Object.fromEntries(all)).toEqual({
      backlog: "todo",
      todo: "todo",
      in_progress: "wip",
      in_review: "wip",
      blocked: "blocked",
      done: "done",
    });
  });

  test("summarizes plan ids, column, tree, blocking deps and the relevant PR", () => {
    const [parent, , child, review] = summarize(snapshot);
    expect(parent).toMatchObject({
      key: "EMIS-1",
      planId: "C1",
      parent: null,
      children: [
        { key: "EMIS-2", planId: "C1-1", status: "done" },
        { key: "EMIS-3", planId: "C1-2", status: "todo" },
      ],
    });
    expect(child).toEqual({
      id: "3",
      key: "EMIS-3",
      planId: "C1-2",
      title: "Ticket 3",
      status: "todo",
      kiboStatus: "todo",
      column: "À faire",
      blockedReason: null,
      parent: { key: "EMIS-1", planId: "C1", status: "todo" },
      children: [],
      deps: [{ key: "EMIS-2", planId: "C1-1", status: "done" }],
      pr: { number: 7, url: "https://github.com/o/r/pull/7", state: "open", review: "none", checks: null },
      assignee: null,
      branch: null,
      labels: [],
      sprint: null,
      feature: null,
      optional: false,
      delivery: null,
      session: null,
      updatedAt: null,
      refs: [plan("C1-2"), pr(5, "closed"), pr(7, "open")],
      startable: true,
      startReason: null,
    });
    expect(review).toMatchObject({ status: "wip", kiboStatus: "in_review", column: "En review", pr: null });
  });

  test("gives the session, the last update, the delivery step and the PR review as they are", () => {
    const delivery = { step: 7, note: "", at: 5, runId: null, kind: "update" as const };
    const reviewed = { ...pr(20, "open"), review: "changes_requested" as const, checks: "error" as const };
    const busy = {
      ...ticket("9", "done", { refs: [reviewed] }),
      delivery,
      session: { tool: "T3 Code", startedAt: 3 },
      updatedAt: 8,
    };
    const [summary] = summarize({ ...snapshot, tickets: [busy] });
    expect(summary).toMatchObject({
      delivery,
      session: { tool: "T3 Code", startedAt: 3 },
      updatedAt: 8,
      pr: { number: 20, review: "changes_requested", checks: "error" },
      refs: [reviewed],
    });
  });

  test("carries the startability the daemon computed", () => {
    const waiting = { kind: "dependency" as const, keys: ["EMIS-2"] };
    const tickets = [
      { ...ticket("7", "todo"), startable: true },
      { ...ticket("8", "todo"), startable: false, startReason: waiting },
    ];
    expect(summarize({ ...snapshot, tickets }).map((t) => [t.startable, t.startReason])).toEqual([
      [true, null],
      [false, waiting],
    ]);
  });

  test("gives the declared branch", () => {
    const branch: ExternalRef = { kind: "git_branch", branch: "feat/x", base: "dev" };
    const [declared, none] = summarize({
      ...snapshot,
      tickets: [ticket("7", "todo", { refs: [branch] }), ticket("8", "todo")],
    });
    expect(declared?.branch).toEqual({ name: "feat/x", base: "dev" });
    expect(none?.branch).toBeNull();
  });

  test("names the assignee from the members, or as the viewer", () => {
    const assigned = (assignee: TicketView["assignee"]) => ({ ...ticket("7", "todo"), assignee });
    const members = [{ userId: "u-adam", name: "Adam", role: "owner" as const }];
    const tickets = [
      assigned({ kind: "human", ref: "u-adam" }),
      assigned({ kind: "human", ref: "u-me" }),
      assigned({ kind: "human", ref: "u-other" }),
      assigned({ kind: "agent", ref: "livraison" }),
    ];
    const people = summarize({ ...snapshot, tickets, viewer: "u-me", sync: { members } }).map(
      (t) => t.assignee,
    );
    expect(people).toEqual([
      { kind: "human", ref: "u-adam", name: "Adam", me: false },
      { kind: "human", ref: "u-me", name: null, me: true },
      { kind: "human", ref: "u-other", name: null, me: false },
      { kind: "agent", ref: "livraison", name: null, me: false },
    ]);
  });

  test("filters on normalized or Kibo statuses", () => {
    const keys = (raw: string) =>
      summarize(snapshot)
        .filter((t) => matchesStatus(t, statusFilter(raw)))
        .map((t) => t.key);
    expect(keys("wip")).toEqual(["EMIS-4"]);
    expect(keys("in_review,blocked")).toEqual(["EMIS-4", "EMIS-6"]);
    expect(() => statusFilter("shipped")).toThrow("INVALID_INPUT");
  });

  test("finds a ticket by key, plan id or node id, ignoring case", () => {
    expect(lookupTicket(snapshot.tickets, "emis-4")?.id).toBe("4");
    expect(lookupTicket(snapshot.tickets, "c1-2")?.id).toBe("3");
    expect(lookupTicket(snapshot.tickets, "5")?.id).toBe("5");
    expect(lookupTicket(snapshot.tickets, "C9-9")).toBeNull();
  });
});
