import { expect, test } from "bun:test";
import type { MomentData, RunMoment } from "@kibo/schema";
import { mergeMoments } from "./use-run-moments";

const moment = (seq: number, at: number, data: MomentData): RunMoment => ({
  id: seq,
  runId: "r1",
  seq,
  at,
  stepId: null,
  data,
});

const MESSAGE: MomentData = { kind: "message", text: "Le sous-agent tourne en arrière-plan." };
const REMINDER: MomentData = { kind: "reminder", reminder: "report_skills" };

test("a moment read late from the transcript is shown at its own time", () => {
  const reminder = moment(3, 62_770, REMINDER);
  const message = moment(5, 62_722, MESSAGE);
  expect(mergeMoments([reminder], [message]).map((m) => m.seq)).toEqual([5, 3]);
});

test("moments of the same time keep their insertion order and are never doubled", () => {
  const first = moment(1, 10, MESSAGE);
  const second = moment(2, 10, REMINDER);
  expect(mergeMoments([second, first], [first]).map((m) => m.seq)).toEqual([1, 2]);
});
