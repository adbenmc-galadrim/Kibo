import { expect, test } from "bun:test";
import { runFixture } from "./fixtures";
import { filterRuns } from "./run-filter";

const runs = [
  runFixture({ id: "a", seq: 3, ticketKey: "KIB-12", state: "done" }),
  runFixture({ id: "b", seq: 7, ticketKey: "KIB-1", state: "failed" }),
  runFixture({ id: "c", seq: 5, ticketKey: "KIB-21", state: "waiting_input" }),
  runFixture({ id: "d", seq: 1, ticketKey: "KIB-3", state: "cancelled" }),
  runFixture({ id: "e", seq: 9, ticketKey: null, ticketTitle: "Générer un composant", state: "running" }),
];
const ids = (list: { id: string }[]) => list.map((r) => r.id);

test("every run is kept, newest first", () => {
  expect(ids(filterRuns(runs, "all", ""))).toEqual(["e", "b", "c", "a", "d"]);
});

test("a state filter keeps only the runs in that state", () => {
  expect(ids(filterRuns(runs, "failed", ""))).toEqual(["b"]);
  expect(ids(filterRuns(runs, "waiting", ""))).toEqual(["c"]);
  expect(ids(filterRuns(runs, "done", ""))).toEqual(["a"]);
  expect(ids(filterRuns(runs, "cancelled", ""))).toEqual(["d"]);
});

test("the key search matches a case-insensitive prefix of the ticket key", () => {
  expect(ids(filterRuns(runs, "all", "kib-1"))).toEqual(["b", "a"]);
  expect(ids(filterRuns(runs, "all", "  KIB-2 "))).toEqual(["c"]);
  expect(ids(filterRuns(runs, "done", "kib-1"))).toEqual(["a"]);
});
