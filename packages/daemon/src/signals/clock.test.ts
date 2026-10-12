import { expect, test } from "bun:test";
import { formatClock } from "./clock";

test("formatClock renders the local hour and minute", () => {
  expect(formatClock(new Date(2026, 9, 12, 14, 41, 30).getTime())).toBe("14:41");
  expect(formatClock(new Date(2026, 9, 12, 9, 5).getTime())).toBe("09:05");
});
