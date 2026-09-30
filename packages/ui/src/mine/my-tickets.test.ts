import { describe, expect, test } from "bun:test";
import type { Assignee } from "@kibo/schema";
import { fac, kib, mineMeta, mineSnapshots, mineTicket, por } from "./fixtures";
import { compareMine, countMine, type MineTab, myTickets } from "./my-tickets";

const keys = (tab: MineTab) =>
  myTickets([kib, por, fac], mineSnapshots, "adam", tab).map((g) => [
    g.project.key,
    g.tickets.map((t) => t.key),
  ]);

describe("my tickets", () => {
  test("assigned to me: open tickets, grouped in sidebar order, mockup order within a project", () => {
    expect(keys("assigned")).toEqual([
      ["KIB", ["KIB-21", "KIB-15", "KIB-9", "KIB-7", "KIB-11", "KIB-22"]],
      ["POR", ["POR-9"]],
      ["FAC", ["FAC-31", "FAC-34"]],
    ]);
    expect(countMine(myTickets([kib, por, fac], mineSnapshots, "adam", "assigned"))).toBe(9);
  });
  test("my agents: open tickets assigned to any agent", () => {
    expect(keys("agents")).toEqual([["KIB", ["KIB-12"]]]);
  });
  test("a ticket waiting for its key comes after the keyed tickets of its rank", () => {
    const adam: Assignee = { kind: "human", ref: "adam" };
    const pending = mineTicket(null, "todo", adam);
    const keyed = mineTicket("KIB-40", "todo", adam);
    expect([pending, keyed].sort(compareMine).map((t) => t.keyLabel)).toEqual(["KIB-40", "KIB-…"]);
  });
  test("a project without snapshot yet is skipped", () => {
    expect(myTickets([mineMeta("x", "X", "X")], mineSnapshots, "adam", "assigned")).toEqual([]);
  });
  test("in a shared project, my tickets follow the account id, not the OS user", () => {
    const base = mineSnapshots.get(kib.id);
    if (!base) throw new Error("fixture kib missing");
    const human = (ref: string) => ({ kind: "human" as const, ref });
    const shared = {
      ...base,
      viewer: "u-adam",
      tickets: base.tickets.map((t) => (t.key === "KIB-21" ? { ...t, assignee: human("u-adam") } : t)),
    };
    const groups = myTickets([kib], new Map([[kib.id, shared]]), "adam", "assigned");
    expect(groups[0]?.tickets.map((t) => t.key)).toContain("KIB-21");
    expect(groups[0]?.tickets.some((t) => t.assignee?.ref === "adam")).toBe(false);
  });
});
