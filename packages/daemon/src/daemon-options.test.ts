import { expect, test } from "bun:test";
import { answerWakeGraceFromArg, clockFromEnv } from "./daemon-options";

test("KIBO_FIXED_NOW freezes the daemon clock and says so in the log", () => {
  const lines: string[] = [];
  const clock = clockFromEnv({ KIBO_FIXED_NOW: "2026-10-16T14:52:00+02:00" }, (line) => lines.push(line));
  expect(clock.fixedNow).toBe("2026-10-16T14:52:00+02:00");
  expect(clock.now()).toBe(Date.parse("2026-10-16T12:52:00Z"));
  expect(lines).toEqual(["[kibo-daemon] clock fixed at 2026-10-16T14:52:00+02:00"]);
});

test("without KIBO_FIXED_NOW the clock is free and nothing is logged", () => {
  const lines: string[] = [];
  const clock = clockFromEnv({}, (line) => lines.push(line));
  expect(clock.fixedNow).toBeNull();
  expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1000);
  expect(lines).toEqual([]);
});

test("an invalid KIBO_FIXED_NOW stops the start", () => {
  expect(() => clockFromEnv({ KIBO_FIXED_NOW: "16/10/2026" }, () => {})).toThrow("INVALID_INPUT");
});

test("--answer-wake-grace-ms sets the grace of a wake on an answer, in milliseconds", () => {
  expect(answerWakeGraceFromArg(undefined)).toBeUndefined();
  expect(answerWakeGraceFromArg("0")).toBe(0);
  expect(answerWakeGraceFromArg("1500")).toBe(1500);
});

test("an invalid --answer-wake-grace-ms stops the start", () => {
  for (const raw of ["", "-1", "1.5", "30s"])
    expect(() => answerWakeGraceFromArg(raw)).toThrow("INVALID_INPUT");
});
