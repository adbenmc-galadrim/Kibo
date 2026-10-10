import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { EMPTY_PROGRESS } from "@kibo/schema";
import fc from "fast-check";
import { filterTickets, labelFilterOf, projectLabels } from "./filter";

const t = (
  key: string,
  assignee: TicketView["assignee"],
  labels: string[] = [],
  startable = false,
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
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable,
  agentProgress: EMPTY_PROGRESS,
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

test("the startable filter keeps only startable tickets and combines with labels and assignee", () => {
  const adam = { kind: "human", ref: "adam" } as const;
  const all = [
    t("KIB-1", adam, ["area:api"], true),
    t("KIB-2", adam, ["area:api"], false),
    t("KIB-3", { kind: "human", ref: "lea" }, ["area:api"], true),
    t("KIB-4", { kind: "agent", ref: "opus-dev" }, [], true),
  ];
  expect(filterTickets(all, "all", "adam", null, true).map((x) => x.key)).toEqual([
    "KIB-1",
    "KIB-3",
    "KIB-4",
  ]);
  expect(filterTickets(all, "all", "adam", "area:api", true).map((x) => x.key)).toEqual(["KIB-1", "KIB-3"]);
  expect(filterTickets(all, "mine-and-agents", "adam", null, true).map((x) => x.key)).toEqual([
    "KIB-1",
    "KIB-4",
  ]);
  expect(filterTickets(all, "mine-and-agents", "adam", "area:api", true).map((x) => x.key)).toEqual([
    "KIB-1",
  ]);
  expect(filterTickets(all, "all", "adam", null, false)).toHaveLength(4);
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
