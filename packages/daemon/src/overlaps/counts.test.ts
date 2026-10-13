import { afterEach, expect, test } from "bun:test";
import type { AgentsState } from "@kibo/schema";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import { overlapAggregates, withOverlapCounts } from "./counts";
import { openOverlapStore } from "./store";

afterEach(cleanupTmp);

const finding = (key: string, owner: string, other: string) => ({
  kind: "export" as const,
  key: `export:${key}`,
  ownerWorkspace: `/w/${owner}`,
  otherWorkspace: `/w/${other}`,
  ownerRunId: owner,
  otherRunId: other,
  detail: { kind: "export" as const, name: key, ownerPath: "a.ts", otherPath: "b.ts" },
});

test("open overlaps are counted per run, and once each in the distinct total", () => {
  const store = openOverlapStore(tmp());
  expect(overlapAggregates(store)).toEqual({ overlaps: [], overlapTotal: 0 });
  store.create(finding("formatDate", "ra", "rb"), "P", 1);
  store.create(finding("parseDate", "ra", "rc"), "P", 2);
  const settled = store.create(finding("toMoney", "rb", "rc"), "P", 3);
  store.event(settled.id, { type: "resolved", role: null, by: null, at: 4 });
  expect(overlapAggregates(store)).toEqual({
    overlaps: [
      { runId: "ra", open: 2 },
      { runId: "rb", open: 1 },
      { runId: "rc", open: 1 },
    ],
    overlapTotal: 2,
  });
  store.close();
});

test("the agents state carries the overlap counts and the distinct total", () => {
  const base: AgentsState = {
    runs: [],
    queue: [],
    host: {
      hostSlots: 1,
      cpuThreshold: 85,
      ramThreshold: 90,
      paused: false,
      autoSlots: 1,
      slotsFixed: false,
      cores: 8,
      ramGb: 16,
      used: 0,
      cpu: 0,
      ram: 0,
    },
    tokensToday: 0,
    resumable: [],
    questions: [],
    projectAgents: [],
    progress: [],
    signals: [],
  };
  const port = { state: () => base, cancel: () => "kept" };
  const counts = { overlaps: [{ runId: "ra", open: 1 }], overlapTotal: 1 };
  const wrapped = withOverlapCounts(port, () => counts);
  expect(wrapped.state()).toEqual({ ...base, ...counts });
  expect(wrapped.cancel()).toBe("kept");
});
