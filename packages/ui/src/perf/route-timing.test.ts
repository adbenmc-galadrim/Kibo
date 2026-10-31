import { expect, test } from "bun:test";
import { type RouteTimingRow, startRouteTiming } from "./route-timing";

function harness() {
  const marks: string[] = [];
  const measures: string[] = [];
  let clock = 0;
  let rpc: (method: string) => void = () => {};
  let hash: () => void = () => {};
  let longTask: () => void = () => {};
  let paint: () => void = () => {};
  let flush: () => void = () => {};
  const tables: RouteTimingRow[][] = [];
  const stop = startRouteTiming({
    mark: (name) => marks.push(name),
    measure: (name) => {
      measures.push(name);
      return clock;
    },
    currentRoute: () => `#/page-${marks.length}`,
    onRpc: (l) => {
      rpc = l;
      return () => {};
    },
    onHashChange: (l) => {
      hash = l;
      return () => {};
    },
    onLongTask: (l) => {
      longTask = l;
      return () => {};
    },
    afterPaint: (l) => {
      paint = l;
    },
    whenQuiet: (l) => {
      flush = l;
      return () => {};
    },
    report: (rows) => tables.push(rows),
  });
  return {
    marks,
    measures,
    tables,
    stop,
    changeRoute: (ms: number) => {
      hash();
      clock = ms;
      paint();
    },
    rpc: (method: string) => rpc(method),
    longTask: () => longTask(),
    flush: () => flush(),
  };
}

test("measures one entry per hash change and counts rpc calls by method", () => {
  const h = harness();
  h.changeRoute(80);
  h.rpc("getProject");
  h.rpc("getProject");
  h.rpc("listProjects");
  h.longTask();
  h.changeRoute(120);
  h.rpc("getProject");
  h.flush();
  expect(h.measures).toHaveLength(2);
  expect(h.tables.at(-1)).toEqual([
    { route: "#/page-1", ms: 80, longTasks: 1, getProject: 2, listProjects: 1 },
    { route: "#/page-2", ms: 120, longTasks: 0, getProject: 1 },
  ]);
});

test("nothing is counted before the first hash change", () => {
  const h = harness();
  h.rpc("getProject");
  h.flush();
  expect(h.tables).toEqual([]);
});
