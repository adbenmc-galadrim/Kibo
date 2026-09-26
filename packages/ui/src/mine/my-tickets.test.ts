import { describe, expect, test } from "bun:test";
import { fac, kib, mineMeta, mineSnapshots, por } from "./fixtures";
import { countMine, type MineTab, myTickets } from "./my-tickets";

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
  test("created by me is empty until tickets record their author (E5)", () => {
    expect(keys("created")).toEqual([]);
  });
  test("a project without snapshot yet is skipped", () => {
    expect(myTickets([mineMeta("x", "X", "X")], mineSnapshots, "adam", "assigned")).toEqual([]);
  });
});
