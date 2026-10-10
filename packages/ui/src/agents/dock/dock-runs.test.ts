import { expect, test } from "bun:test";
import type { AgentsState } from "@kibo/schema";
import { agentsFixture, NOW, runFixture } from "../fixtures";
import { dockGroups } from "./dock-runs";

const HOUR = 3_600_000;

const ids = (runs: { id: string }[]) => runs.map((r) => r.id);

test("the dock groups active, waiting and queued runs like the bar", () => {
  const groups = dockGroups(agentsFixture(), NOW);
  expect(ids(groups.active)).toEqual(["r42", "r43", "r44"]);
  expect(ids(groups.waiting)).toEqual(["r41"]);
  expect(ids(groups.queued)).toEqual(["q10", "q18", "q29", "q60"]);
});

test("the recent runs are the ones finished within 24 hours, newest first", () => {
  const state: AgentsState = {
    ...agentsFixture(),
    runs: [
      runFixture({ id: "old", state: "done", endedAt: NOW - 25 * HOUR }),
      runFixture({ id: "edge", state: "failed", endedAt: NOW - 24 * HOUR }),
      runFixture({ id: "new", state: "cancelled", endedAt: NOW - HOUR }),
      runFixture({ id: "mid", state: "done", endedAt: NOW - 5 * HOUR }),
      runFixture({ id: "live", state: "running", startedAt: NOW - HOUR }),
    ],
    queue: [],
  };
  expect(ids(dockGroups(state, NOW).recent)).toEqual(["new", "mid", "edge"]);
});
