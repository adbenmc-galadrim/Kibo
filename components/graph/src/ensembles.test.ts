import { expect, test } from "bun:test";
import { EMPTY_PROGRESS, type TicketView } from "@kibo/schema";
import type { GraphEdge } from "./critical-path";
import { ensembleEdges, ensembleIndex } from "./ensembles";

const t = (id: string, parentId: string | null, total = 0, done = 0): TicketView => ({
  id,
  key: id,
  pendingSeq: null,
  keyLabel: id,
  title: `Titre ${id}`,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId,
  labels: [],
  externalRefs: [],
  progress: { done, total },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
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
const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

const tickets = [
  t("C4", null, 3, 1),
  t("A", "C4"),
  t("N", "C4", 2),
  t("N1", "N"),
  t("N2", "N"),
  t("X", null),
];

test("each sub-ticket belongs to the frame of its own group, nested groups included", () => {
  const index = ensembleIndex(tickets);
  expect(Object.fromEntries(index.groupOf)).toEqual({ A: "C4", N: "C4", N1: "N", N2: "N" });
  expect(index.info.get("C4")).toEqual({ name: "C4", label: "C4 · Titre C4 · 1/3", compact: "C4 · 1/3" });
  expect(index.info.get("N")?.compact).toBe("N · 0/2");
  expect(index.info.has("X")).toBe(false);
});

test("links set on a group attach to its frame; links from a sub-ticket to its own group are dropped", () => {
  const index = ensembleIndex(tickets);
  expect(
    ensembleEdges([blocks("C4", "X"), blocks("X", "N"), blocks("A", "C4"), blocks("A", "X")], index),
  ).toEqual([blocks("group:ensemble:C4", "X"), blocks("X", "group:ensemble:N"), blocks("A", "X")]);
});
