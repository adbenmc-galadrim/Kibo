import { expect, test } from "bun:test";
import type { RunLogEntry } from "@kibo/schema";
import { draftRelativeLog } from "./draft-log";

const ID = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";

const hook = (detail: string | null): RunLogEntry => ({
  id: 1,
  at: 1,
  event: {
    type: "hook",
    payload: {
      event: "PostToolUse",
      sessionId: "s1",
      transcriptPath: null,
      tool: "Write",
      detail,
      question: null,
      agentId: null,
      ask: null,
    },
  },
});

const detailOf = (entry: RunLogEntry | undefined) =>
  entry?.event.type === "hook" ? entry.event.payload.detail : undefined;

test("draftRelativeLog shows the files written by the agent relative to its draft folder", () => {
  const log = [
    hook(`/private/tmp/kibo/components/drafts/${ID}/ui.tsx`),
    hook(null),
    hook("kibo component test ."),
  ];
  expect(draftRelativeLog(log, ID).map(detailOf)).toEqual(["ui.tsx", null, "kibo component test ."]);
});

test("draftRelativeLog leaves the paths of another draft untouched", () => {
  const other = "/home/a/.kibo/components/drafts/other/ui.tsx";
  expect(detailOf(draftRelativeLog([hook(other)], ID)[0])).toBe(other);
});
