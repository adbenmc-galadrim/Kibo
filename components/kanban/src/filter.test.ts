import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { filterTickets } from "./filter";

const t = (key: string, assignee: TicketView["assignee"]): TicketView => ({
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
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
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
