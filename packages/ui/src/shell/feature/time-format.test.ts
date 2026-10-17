import { expect, test } from "bun:test";
import { ageLabel, dateRange, shortTime, stepTime } from "./time-format";

const now = new Date(2026, 9, 16, 14, 52).getTime();
const at = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).getTime();

test("a step time shows the hour today, « hier » the day before, the date otherwise", () => {
  expect(stepTime(at(16, 15, 4), now)).toBe("15:04");
  expect(stepTime(at(15, 18, 22), now)).toBe("hier 18:22");
  expect(stepTime(at(12, 9, 5), now)).toBe("12 oct. 09:05");
});

test("an activity time drops the hour before today", () => {
  expect(shortTime(at(16, 14, 51), now)).toBe("14:51");
  expect(shortTime(at(15, 18, 22), now)).toBe("hier");
  expect(shortTime(at(2, 8, 0), now)).toBe("2 oct.");
});

test("an age counts whole days", () => {
  expect(ageLabel(at(16, 8, 0), now)).toBe("aujourd'hui");
  expect(ageLabel(at(15, 23, 0), now)).toBe("hier");
  expect(ageLabel(at(13, 23, 0), now)).toBe("il y a 3 j");
});

test("a sprint range writes the month once when it does not change", () => {
  expect(dateRange("2026-10-12", "2026-10-16")).toBe("12–16 oct.");
  expect(dateRange("2026-09-28", "2026-10-02")).toBe("28 sept.–2 oct.");
});
