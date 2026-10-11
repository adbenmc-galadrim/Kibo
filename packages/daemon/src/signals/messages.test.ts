import { expect, test } from "bun:test";
import { clockTime } from "./messages";

test("a time is shown as local hours and minutes", () => {
  expect(clockTime(new Date(2026, 9, 12, 9, 5).getTime())).toBe("09:05");
  expect(clockTime(new Date(2026, 9, 12, 14, 41).getTime())).toBe("14:41");
});
